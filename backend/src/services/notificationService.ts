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
// staff/system messages) debits 1 unit from that hospital's prepaid
// SmsWallet. See services/smsWalletService.ts for the wallet itself and
// modules/sms-wallet/routes.ts for the top-up API.

import { debitSmsUnit, refundSmsUnit } from "./smsWalletService";

type SendResult = { ok: boolean; providerRef?: string; error?: string };

const whatsappEnabled = process.env.WHATSAPP_PROVIDER_ENABLED === "true";
const smsEnabled = process.env.SMS_PROVIDER_ENABLED === "true";
const emailEnabled = process.env.EMAIL_PROVIDER_ENABLED === "true";

export async function sendWhatsApp(
  to: string,
  body: string,
): Promise<SendResult> {
  if (!whatsappEnabled) {
    console.log(`[MOCK WHATSAPP] to=${to} :: ${body}`);
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

  try {
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/^\+/, ""),
          type: "text",
          text: { body },
        }),
      },
    );
    const result = (await response.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      return {
        ok: false,
        error:
          result.error?.message || "WhatsApp Business Cloud API request failed",
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

export async function sendSms(to: string, body: string): Promise<SendResult> {
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
      return { ok: true, providerRef: result.message_id };
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
          Recipients?: Array<{ messageId?: string; status?: string }>;
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
      return { ok: true, providerRef: recipient?.messageId };
    }

    return { ok: false, error: `Unsupported SMS_PROVIDER: ${provider}` };
  } catch (err: any) {
    console.error("[sendSms] failed:", err);
    return { ok: false, error: err.message || "Failed to send SMS" };
  }
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
): Promise<SendResult> {
  switch (channel) {
    case "whatsapp":
      return sendWhatsApp(to, body);
    case "sms":
      return sendBilledSms(to, body, tenantId);
    case "email":
      return sendEmail(to, subject, body);
  }
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

  const debited = await debitSmsUnit(tenantId);
  if (!debited) {
    return {
      ok: false,
      error:
        "Insufficient SMS balance — top up SMS units to keep sending text messages.",
    };
  }

  const result = await sendSms(to, body);
  if (!result.ok) {
    await refundSmsUnit(tenantId, result.error || "provider send failed");
  }
  return result;
}
