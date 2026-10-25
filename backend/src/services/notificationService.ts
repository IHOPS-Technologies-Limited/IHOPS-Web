// Messaging adapters for WhatsApp / SMS / Email.
//
// All three are real integrations, each gated behind its own
// *_PROVIDER_ENABLED env flag so the whole app still runs with mock
// (console-logged) sends out of the box:
//   - WhatsApp: WhatsApp Business Cloud API (Meta)
//   - SMS: Termii or Africa's Talking (Nigerian providers)
//   - Email: Resend transactional-email API
// Flip the relevant *_PROVIDER_ENABLED flag + set that provider's
// credentials in .env to go live — no caller code needs to change.
//
// SMS is additionally metered: every SMS to a patient (sent via
// sendOnChannel, not the direct sendSms() calls used for internal
// staff/system messages) debits 1 unit PER SMS PAGE from that hospital's
// prepaid SmsWallet (a 160-char message is 1 page; longer messages, or ones
// containing characters like ₦ or curly quotes, take more — lib/smsSegments.ts).
// Every real provider send, billed or internal, is also written to SmsSendLog
// with the provider's reported balance so the true naira cost is visible. See services/smsWalletService.ts for the wallet itself and
// modules/sms-wallet/routes.ts for the top-up API.

import { debitSmsUnit, refundSmsUnit } from "./smsWalletService";
import { smsSegments } from "../lib/smsSegments";
import { recordSmsSend } from "./smsCostService";

export type SendResult = {
  ok: boolean;
  providerRef?: string;
  error?: string;
  // SMS only: what the provider reported about its own books.
  providerBalance?: number; // account balance after this send (Termii: naira)
  providerCost?: number; // cost of this send, when the provider states it
};

function toNumber(v: unknown): number | undefined {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

const whatsappEnabled = process.env.WHATSAPP_PROVIDER_ENABLED === "true";
const smsEnabled = process.env.SMS_PROVIDER_ENABLED === "true";
const emailEnabled = process.env.EMAIL_PROVIDER_ENABLED === "true";

// Meta's Cloud API wants the number as digits only, WITH country code and no
// leading 0 or + (e.g. 2348031234567). Patients' numbers are usually saved the
// Nigerian way (0803 123 4567), which Meta rejects as an invalid parameter —
// the SMS path already normalised this, WhatsApp didn't.
export function normalizeWhatsAppNumber(raw: string): string {
  const cc =
    process.env.WHATSAPP_DEFAULT_COUNTRY_CODE ||
    process.env.SMS_DEFAULT_COUNTRY_CODE ||
    "234";
  let n = raw.replace(/\D/g, "");
  if (n.startsWith("00"))
    n = n.slice(2); // 00234… international prefix
  else if (n.startsWith("0"))
    n = cc + n.slice(1); // 0803… national format
  else if (cc === "234" && /^[789]\d{9}$/.test(n)) n = cc + n; // 803… with the 0 dropped
  return n;
}

// Turns Meta's error codes into something an administrator can act on, while
// always keeping Meta's own wording + code so nothing is hidden.
function whatsappErrorMessage(err: {
  message?: string;
  code?: number;
  error_data?: { details?: string };
}): string {
  const raw = [err.message, err.error_data?.details]
    .filter(Boolean)
    .join(" — ");
  const tag = `(WhatsApp error ${err.code ?? "?"}: ${raw || "request failed"})`;
  switch (err.code) {
    case 190:
    case 463:
    case 467:
      return `WhatsApp access token is expired or invalid. Temporary tokens last only 24 hours — create a permanent System User token in Meta Business settings. ${tag}`;
    case 131047:
    case 131051:
      return `Outside the 24-hour window. WhatsApp only allows free-text messages within 24 hours of the patient's last message to you; otherwise an approved message template is required. ${tag}`;
    case 131030:
      return `This number isn't on the allowed recipient list for your WhatsApp TEST number. Add it in Meta → WhatsApp → API Setup, or switch to a real registered number. ${tag}`;
    case 131026:
      return `Undeliverable — the patient's number isn't on WhatsApp, or they haven't accepted WhatsApp's latest terms. ${tag}`;
    case 133010:
      return `The sending phone number isn't registered with the WhatsApp Cloud API yet. ${tag}`;
    case 10:
    case 200:
    case 131005:
      return `The access token lacks permission to send WhatsApp messages (needs whatsapp_business_messaging). ${tag}`;
    case 132001:
      return `The WhatsApp message template wasn't found. Check that WHATSAPP_TEMPLATE_GENERAL / WHATSAPP_TEMPLATE_BIRTHDAY exactly match the approved template names, and that WHATSAPP_TEMPLATE_LANGUAGE matches the template's language code. ${tag}`;
    case 132000:
    case 132012:
    case 132018:
      return `WhatsApp rejected the template's filled-in values (wrong number of values, or text with line breaks / long runs of spaces). ${tag}`;
    case 132015:
    case 132016:
      return `This WhatsApp template is paused or disabled by Meta (usually due to low quality ratings). Review it in WhatsApp Manager. ${tag}`;
    case 131042:
      return `Meta can't bill the WhatsApp account — add or fix the payment method on the WhatsApp Business Account in Meta Business Settings. ${tag}`;
    case 131049:
      return `Meta declined to deliver this message to keep the patient from receiving too many marketing messages. It may deliver on a later attempt. ${tag}`;
    case 131048:
    case 130429:
    case 131056:
    case 80007:
      return `WhatsApp is rate-limiting sends right now (too many messages too quickly, or to the same patient). Try again shortly. ${tag}`;
    case 100:
      return `WhatsApp rejected a parameter — usually the Phone Number ID is wrong (use the numeric ID, not the phone number) or the patient's number is malformed. ${tag}`;
    default:
      return tag;
  }
}

// ---------------------------------------------------------------------------
// WhatsApp (one shared IHOPS number for every hospital)
//
// WhatsApp only lets a business start a conversation — or write to someone who
// hasn't messaged it in the last 24 hours — with a pre-approved TEMPLATE, never
// free text. IHOPS therefore sends template messages:
//
//   general  (UTILITY)   "Hello {{1}}, you have a message from {{2}}: {{3}} …"
//                        {{1}} recipient, {{2}} hospital, {{3}} the message text
//   birthday (MARKETING) "Happy Birthday, {{1}}! … everyone at {{2}} …"
//                        {{1}} recipient, {{2}} hospital (message text unused)
//
// Names come from WHATSAPP_TEMPLATE_GENERAL / WHATSAPP_TEMPLATE_BIRTHDAY. If the
// birthday template isn't set, birthdays use the general template. If NO
// template is configured at all, it falls back to free text, which only works
// inside the 24-hour window (kept so existing setups don't break).
// Because the hospital's name is a template value, one number serves everyone.
// ---------------------------------------------------------------------------
export type WhatsAppContext = {
  kind: "general" | "birthday";
  recipientName: string;
  hospitalName: string;
};

// Template values can't contain line breaks/tabs or 4+ consecutive spaces
// (Meta error 132018), so flatten them; and Meta caps a template body at 1024
// characters — rather than silently cutting off a clinical instruction we
// refuse to send an over-long message.
const WA_MAX_MESSAGE_CHARS = 800;
function waParam(text: string): string {
  return text
    .replace(/\s*[\r\n\t]+\s*/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim();
}

export function whatsappTemplateFor(
  kind: WhatsAppContext["kind"],
): string | null {
  const general = process.env.WHATSAPP_TEMPLATE_GENERAL?.trim() || null;
  const birthday = process.env.WHATSAPP_TEMPLATE_BIRTHDAY?.trim() || null;
  return kind === "birthday" ? birthday || general : general;
}

export async function sendWhatsApp(
  to: string,
  body: string,
  ctx?: WhatsAppContext,
): Promise<SendResult> {
  const templateName = ctx ? whatsappTemplateFor(ctx.kind) : null;
  if (!whatsappEnabled) {
    console.log(
      `[MOCK WHATSAPP] to=${to} ${templateName ? `template=${templateName} ` : ""}:: ${body}`,
    );
    return { ok: true, providerRef: `mock-wa-${Date.now()}` };
  }
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";

  if (!accessToken || !phoneNumberId) {
    return {
      ok: false,
      error:
        "WHATSAPP_PROVIDER_ENABLED is true but WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set",
    };
  }

  let payload: Record<string, unknown>;
  if (templateName && ctx) {
    const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en";
    const usesBirthdayTemplate =
      ctx.kind === "birthday" &&
      !!process.env.WHATSAPP_TEMPLATE_BIRTHDAY?.trim();
    const values = usesBirthdayTemplate
      ? [ctx.recipientName, ctx.hospitalName]
      : [ctx.recipientName, ctx.hospitalName, body];
    const params = values.map((v) => waParam(v));
    if (params.some((v) => v === "")) {
      return {
        ok: false,
        error:
          "WhatsApp message is missing a required value (recipient name, hospital name or message text).",
      };
    }
    if (!usesBirthdayTemplate && params[2].length > WA_MAX_MESSAGE_CHARS) {
      return {
        ok: false,
        error: `This message is ${params[2].length} characters — WhatsApp templates allow about ${WA_MAX_MESSAGE_CHARS}. Shorten it (or send it by SMS/email).`,
      };
    }
    payload = {
      messaging_product: "whatsapp",
      to: normalizeWhatsAppNumber(to),
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components: [
          {
            type: "body",
            parameters: params.map((text) => ({ type: "text", text })),
          },
        ],
      },
    };
  } else {
    // No template configured: free text (only delivered inside the 24h window).
    payload = {
      messaging_product: "whatsapp",
      to: normalizeWhatsAppNumber(to),
      type: "text",
      text: { body },
    };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    const result = (await response.json()) as {
      messages?: Array<{ id?: string }>;
      error?: {
        message?: string;
        code?: number;
        error_data?: { details?: string };
      };
    };

    if (!response.ok) {
      console.error(
        "[sendWhatsApp] Meta rejected the message:",
        JSON.stringify(result.error),
      );
      return {
        ok: false,
        error: whatsappErrorMessage(result.error || {}),
      };
    }

    return { ok: true, providerRef: result.messages?.[0]?.id };
  } catch (err: any) {
    console.error("[sendWhatsApp] failed:", err);
    return {
      ok: false,
      error: err.message || "Failed to send WhatsApp message",
    };
  }
}

async function sendSmsRaw(to: string, body: string): Promise<SendResult> {
  if (!smsEnabled) {
    console.log(`[MOCK SMS] to=${to} :: ${body}`);
    return { ok: true, providerRef: `mock-sms-${Date.now()}` };
  }

  const provider = (process.env.SMS_PROVIDER || "termii").toLowerCase();
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "SMS_PROVIDER_ENABLED is true but SMS_API_KEY must be set",
    };
  }

  try {
    if (provider === "termii") {
      const normalizedTo = to
        .replace(/\D/g, "")
        .replace(/^0/, process.env.SMS_DEFAULT_COUNTRY_CODE || "234");
      const termiiBaseUrl = (
        process.env.TERMII_BASE_URL || "https://v4.api.termii.com"
      ).replace(/\/$/, "");
      const endpoint = `${termiiBaseUrl}/api/sms/send`;
      console.log("[sendSms:Termii] sending", {
        endpoint,
        to: normalizedTo,
        senderId: process.env.SMS_SENDER_ID || "IHOPS",
        channel: process.env.TERMII_CHANNEL || "generic",
      });
      const request = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          to: normalizedTo,
          from: process.env.SMS_SENDER_ID || "IHOPS",
          sms: body,
          type: "plain",
          channel: process.env.TERMII_CHANNEL || "generic",
        }),
      };
      let response: Response;
      try {
        response = await fetch(endpoint, request);
      } catch (err: any) {
        const fallbackEndpoint = "https://api.ng.termii.com/api/sms/send";
        if (
          err.cause?.code !== "UND_ERR_CONNECT_TIMEOUT" ||
          endpoint === fallbackEndpoint
        ) {
          throw err;
        }
        console.warn(
          "[sendSms:Termii] v4 connection timed out; retrying legacy endpoint",
          {
            fallbackEndpoint,
          },
        );
        response = await fetch(fallbackEndpoint, request);
      }
      const responseText = await response.text();
      let result: {
        message_id?: string;
        message?: string;
        balance?: number | string;
      } = {};
      try {
        result = JSON.parse(responseText);
      } catch {
        console.error("[sendSms:Termii] non-JSON response", {
          status: response.status,
          body: responseText,
        });
        return { ok: false, error: "Termii returned an invalid response" };
      }
      console.log("[sendSms:Termii] response", {
        status: response.status,
        ok: response.ok,
        result: JSON.stringify(result),
      });
      if (!response.ok) {
        return {
          ok: false,
          error: result.message || "Termii SMS request failed",
        };
      }
      return {
        ok: true,
        providerRef: result.message_id,
        providerBalance: toNumber(result.balance),
      };
    }

    if (provider === "africastalking") {
      const params = new URLSearchParams({
        username: process.env.AFRICASTALKING_USERNAME || "sandbox",
        to,
        message: body,
      });
      const senderId = process.env.SMS_SENDER_ID;
      if (senderId) params.set("from", senderId);

      const response = await fetch(
        "https://api.africastalking.com/version1/messaging",
        {
          method: "POST",
          headers: {
            apiKey,
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        },
      );
      const result = (await response.json()) as {
        SMSMessageData?: {
          Recipients?: Array<{
            messageId?: string;
            status?: string;
            cost?: string;
          }>;
        };
        errorMessage?: string;
      };
      if (!response.ok) {
        return {
          ok: false,
          error: result.errorMessage || "Africa's Talking SMS request failed",
        };
      }
      const recipient = result.SMSMessageData?.Recipients?.[0];
      if (recipient?.status && recipient.status !== "Success") {
        return { ok: false, error: recipient.status };
      }
      // Africa's Talking states the cost per recipient, e.g. "NGN 4.0000".
      const costMatch = /^NGN\s*([\d.]+)/i.exec(recipient?.cost || "");
      return {
        ok: true,
        providerRef: recipient?.messageId,
        providerCost: costMatch ? toNumber(costMatch[1]) : undefined,
      };
    }

    return { ok: false, error: `Unsupported SMS_PROVIDER: ${provider}` };
  } catch (err: any) {
    console.error("[sendSms] failed:", err);
    return { ok: false, error: err.message || "Failed to send SMS" };
  }
}

// Sends one SMS and logs it (see SmsSendLog). `ctx.tenantId` + `unitsBilled`
// are set by the billed patient path; direct callers (staff PINs, system
// texts) get purpose "internal" — they cost real naira but are never billed to
// a hospital wallet, which is exactly what the log makes visible.
export async function sendSms(
  to: string,
  body: string,
  ctx: { tenantId?: string; unitsBilled?: number } = {},
): Promise<SendResult> {
  const result = await sendSmsRaw(to, body);
  if (smsEnabled) {
    await recordSmsSend({
      tenantId: ctx.tenantId ?? null,
      purpose: ctx.tenantId ? "patient" : "internal",
      to,
      body,
      unitsBilled: ctx.unitsBilled ?? 0,
      result,
    });
  }
  return result;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  if (!emailEnabled) {
    console.log(`[MOCK EMAIL] to=${to} subject="${subject}" :: ${body}`);
    return { ok: true, providerRef: `mock-email-${Date.now()}` };
  }
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) {
      return {
        ok: false,
        error:
          "EMAIL_PROVIDER_ENABLED is true but RESEND_API_KEY and RESEND_FROM must be set",
      };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
        html: renderEmailHtml(subject, body),
      }),
    });
    const result = (await response.json()) as { id?: string; message?: string };
    if (!response.ok) {
      console.error("[sendEmail:Resend] failed:", result);
      return {
        ok: false,
        error: result.message || "Resend email request failed",
      };
    }
    return { ok: true, providerRef: result.id };
  } catch (err: any) {
    console.error("[sendEmail] failed:", err);
    return { ok: false, error: err.message || "Failed to send email" };
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );
}

// A single shared branded wrapper for every email the app sends. Callers
// still just pass a plain-text `body` (see sendEmail above) — this splits it
// on blank lines into paragraphs, auto-links any bare URL onto its own line
// (verification links, sign-in links, etc. are always written as their own
// line for exactly this reason), and wraps the result in a card with the
// IHOPS header/footer so every email — verification, staff invites,
// approvals, subscription notices, support replies — looks like it came
// from the same product instead of a bare string of text.
function renderEmailHtml(subject: string, body: string): string {
  const paragraphs = body
    .split(/\n\s*\n|\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const urlPattern = /^(https?:\/\/\S+)$/;
  const paragraphHtml = paragraphs
    .map((line) => {
      const match = line.match(urlPattern);
      if (match) {
        return `<div style="margin:20px 0;"><a href="${escapeHtml(match[1])}" style="display:inline-block;background:#1A312C;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Open link</a></div>`;
      }
      return `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#1e293b;">${escapeHtml(line)}</p>`;
    })
    .join("\n");

  return `
<div style="background:#F1F5F9;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
    <div style="background:#1A312C;padding:24px 32px;">
      <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.02em;">IHOPS</span>
      <div style="color:#89D7B7;font-size:11px;margin-top:2px;">Intelligent Hospital Operation System</div>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 18px 0;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(subject)}</h1>
      ${paragraphHtml}
    </div>
    <div style="padding:20px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated message from IHOPS. If you weren't expecting this email, you can safely ignore it.</p>
    </div>
  </div>
</div>`.trim();
}

// tenantId is required to bill SMS against the right hospital's wallet.
// The three callers that write to CommunicationLog (communications/routes.ts,
// visits/routes.ts, ai-communication/routes.ts) all have req.tenantId
// available and pass it through. Internal/system sends (staff PIN resets,
// signup OTPs, etc.) go through sendSms()/sendEmail() directly instead of
// this function, and are never billed to a wallet.
export async function sendOnChannel(
  channel: "whatsapp" | "sms" | "email",
  to: string,
  body: string,
  tenantId?: string,
  subject = "IHOPS Notification",
  whatsapp?: WhatsAppContext,
): Promise<SendResult> {
  switch (channel) {
    case "whatsapp":
      return sendBilledWhatsApp(to, body, tenantId, whatsapp);
    case "sms":
      return sendBilledSms(to, body, tenantId);
    case "email":
      return sendEmail(to, subject, body);
  }
}

// WhatsApp template messages cost IHOPS real money (Meta bills the account per
// delivered template message), so — like SMS — they draw on the hospital's
// prepaid wallet. WHATSAPP_UNITS_PER_MESSAGE sets the price in units (default
// 1; set 0 to make WhatsApp free to hospitals). Failed sends are refunded.
function whatsappUnits(): number {
  const n = parseInt(process.env.WHATSAPP_UNITS_PER_MESSAGE ?? "1", 10);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

async function sendBilledWhatsApp(
  to: string,
  body: string,
  tenantId?: string,
  ctx?: WhatsAppContext,
): Promise<SendResult> {
  const units = whatsappUnits();
  if (!tenantId || units === 0) return sendWhatsApp(to, body, ctx);

  const debited = await debitSmsUnit(
    tenantId,
    undefined,
    units,
    undefined,
    "WhatsApp message",
  );
  if (!debited) {
    return {
      ok: false,
      error: `Insufficient balance — a WhatsApp message uses ${units} unit${units === 1 ? "" : "s"}. Top up SMS units to keep sending.`,
    };
  }
  const result = await sendWhatsApp(to, body, ctx);
  if (!result.ok) {
    await refundSmsUnit(
      tenantId,
      result.error?.slice(0, 120) || "WhatsApp send failed",
      undefined,
      units,
    );
  }
  return result;
}

// Debit-then-send-then-refund-on-failure wrapper around sendSms(). Missing
// tenantId is a programming error in a caller, not a user-facing case — it
// falls back to an unbilled send rather than silently dropping the message,
// but logs loudly so it gets noticed and fixed.
async function sendBilledSms(
  to: string,
  body: string,
  tenantId?: string,
): Promise<SendResult> {
  if (!tenantId) {
    console.error(
      "[sendBilledSms] no tenantId passed — sending unbilled. Fix the caller to pass tenantId.",
    );
    return sendSms(to, body);
  }

  // Providers bill per SMS page, so the hospital is charged per page too
  // (1 unit per page). A message over 160 characters — or any length once it
  // contains a non-GSM character such as ₦ or a curly quote — takes 2+ pages.
  const seg = smsSegments(body);
  const detail = `${seg.pages} page${seg.pages === 1 ? "" : "s"}, ${seg.characters} ${seg.encoding === "gsm" ? "chars" : "chars, unicode"}`;
  const debited = await debitSmsUnit(tenantId, undefined, seg.pages, detail);
  if (!debited) {
    return {
      ok: false,
      error:
        seg.pages > 1
          ? `Insufficient SMS balance — this message is ${seg.pages} SMS pages and needs ${seg.pages} units. Top up SMS units or shorten the message.`
          : "Insufficient SMS balance — top up SMS units to keep sending text messages.",
    };
  }

  const result = await sendSms(to, body, { tenantId, unitsBilled: seg.pages });
  if (!result.ok) {
    await refundSmsUnit(
      tenantId,
      result.error || "provider send failed",
      undefined,
      seg.pages,
    );
  }
  return result;
}
