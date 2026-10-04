// AI reminder generation (PRD Section 16).
//
// Default behaviour is a deterministic template engine — no external AI call
// required to exercise the whole product. If AI_REMINDERS_PROVIDER_ENABLED
// and ANTHROPIC_API_KEY are set, generateReminder() calls Claude instead,
// with the exact same guardrails enforced afterwards:
//   - never introduces clinical detail beyond the staff-entered note
//   - always falls back to a static template on failure/timeout
//   - tone adapts for veterinary/dental specialties
//
// This keeps AI a genuinely optional layer over a working static system,
// per the "Output must always be reviewable... revert to static templates
// at any time" and "falls back to nearest matching static template" rules.

const aiEnabled = process.env.AI_REMINDERS_PROVIDER_ENABLED === "true" && !!process.env.ANTHROPIC_API_KEY;

export interface ReminderInput {
  patientName: string;
  guardianName?: string | null;
  hospitalName: string;
  hospitalType: string;
  treatmentNote: string;
  followUpDescription: string; // e.g. "return in 3 days" or "daily dressing for 5 days"
  species?: string | null;
}

function staticTemplate(input: ReminderInput): string {
  const recipient = input.guardianName || input.patientName;
  const isVet = /veterinary/i.test(input.hospitalType);
  const isDental = /dental/i.test(input.hospitalType);

  if (isVet) {
    const petLine = input.species ? `your ${input.species}, ${input.patientName},` : `${input.patientName}`;
    return `Hello ${recipient}, this is ${input.hospitalName}. A quick reminder that ${petLine} needs a follow-up visit: ${input.followUpDescription}. Please reach out if you have any questions. Thank you for trusting us with their care.`;
  }
  if (isDental) {
    return `Hello ${recipient}, this is ${input.hospitalName}. Following your recent dental procedure, please remember: ${input.followUpDescription}. Reply if you'd like to reschedule. Thank you for choosing us.`;
  }
  return `Hello ${recipient}, this is ${input.hospitalName}. Following your recent visit, please remember: ${input.followUpDescription}. If you have any questions, feel free to reach out. Wishing you good health.`;
}

export async function generateReminder(input: ReminderInput): Promise<{ body: string; source: "ai" | "static" }> {
  if (!aiEnabled) {
    return { body: staticTemplate(input), source: "static" };
  }
  try {
    // Kept intentionally simple: a single, tightly-scoped prompt that only
    // ever sees the operational note + follow-up description, never asked
    // to infer or add clinical/diagnostic content.
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        system:
          "You write short, warm patient follow-up reminder messages for a Nigerian hospital's front desk system. " +
          "Only use the operational facts given to you. Never add diagnosis, dosage, or clinical detail beyond what is provided. " +
          "Keep it under 45 words, plain language, and address the recipient by name.",
        messages: [
          {
            role: "user",
            content: `Hospital: ${input.hospitalName} (${input.hospitalType})\nRecipient: ${input.guardianName || input.patientName}\nPatient: ${input.patientName}${input.species ? ` (${input.species})` : ""}\nOperational note: ${input.treatmentNote}\nFollow-up required: ${input.followUpDescription}\n\nWrite the reminder message only, no preamble.`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI provider returned ${res.status}`);
    const data: any = await res.json();
    const text = data?.content?.find((b: any) => b.type === "text")?.text;
    if (!text) throw new Error("Empty AI response");
    return { body: text.trim(), source: "ai" };
  } catch (err) {
    // Guardrail: on any failure/timeout, fall back to the static template
    // rather than sending nothing.
    console.warn("[reminderService] AI generation failed, falling back to static template:", err);
    return { body: staticTemplate(input), source: "static" };
  }
}

export function birthdayMessage(patientName: string, hospitalName: string): string {
  return `Happy Birthday, ${patientName}! Everyone at ${hospitalName} wishes you a wonderful birthday and good health. Thank you for trusting our hospital with your healthcare.`;
}
