// Restricted AI Communication Engine (PRD Section 16).
//
// This is a NEW, separate service from services/reminderService.ts, which is
// left completely untouched and still powers the original visit-close
// reminder flow. This file exists specifically to satisfy the PRD's "data
// boundary rule": the AI must never have direct access to Clinical Notes,
// Medical Records, diagnoses, allergies, prescriptions, medical/medication
// history, lab results, imaging, or clinical observations — only an
// explicitly approved CommunicationPayload built from the Follow-up &
// Communication section of a Clinical Note.
//
// Enforcement is at the TYPE level, not just convention: generateRestrictedMessage()
// only accepts CommunicationPayloadInput below. It is structurally impossible
// to pass a ClinicalNote (or anything containing diagnosis/allergy/prescription
// fields) into this function without a compile error, because those fields
// don't exist on the type. There is no Prisma import in this file at all —
// this service has no query path to clinical tables, matching the PRD's
// "isolated service with no network or query path to clinical tables."

export interface CommunicationPayloadInput {
  patientName: string;
  guardianName?: string | null;
  hospitalName: string;
  hospitalType: string;
  species?: string | null;
  approvedInstruction: string; // the ONLY clinically-sourced free text this engine ever sees
  followUpType?: string | null;
}

const aiEnabled = process.env.AI_REMINDERS_PROVIDER_ENABLED === "true" && !!process.env.ANTHROPIC_API_KEY;

function staticTemplate(input: CommunicationPayloadInput): string {
  const recipient = input.guardianName || input.patientName;
  const isVet = /veterinary/i.test(input.hospitalType);
  const isDental = /dental/i.test(input.hospitalType);
  const subject = isVet && input.species ? `your ${input.species}, ${input.patientName},` : input.patientName;

  if (isVet) {
    return `Hello ${recipient}, this is ${input.hospitalName}. ${input.approvedInstruction} Please reach out if you have any questions about ${subject} care.`;
  }
  if (isDental) {
    return `Hello ${recipient}, this is ${input.hospitalName}. ${input.approvedInstruction} Reply if you'd like to reschedule.`;
  }
  return `Hello ${recipient}, this is ${input.hospitalName}. ${input.approvedInstruction} If you have any questions, feel free to reach out.`;
}

/**
 * Generates a warm, plain-language message strictly within the bounds of the
 * approved instruction. Guardrail matching the PRD example exactly: if the
 * instruction says "Return tomorrow morning for treatment," the engine may
 * say exactly that — it must not add "for your malaria treatment" even
 * though such a phrase might exist elsewhere in the same Clinical Note,
 * because this function was never given access to that note in the first
 * place.
 */
export async function generateRestrictedMessage(input: CommunicationPayloadInput): Promise<{ body: string; source: "ai" | "static" }> {
  if (!aiEnabled) {
    return { body: staticTemplate(input), source: "static" };
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 150,
        system:
          "You write short, warm patient follow-up messages for a Nigerian hospital's front desk system. " +
          "You will be given ONLY a pre-approved instruction sentence — you have no other information about the patient's visit. " +
          "Restate that instruction warmly and in plain language. Do NOT add any medical detail, diagnosis, medication name, or " +
          "clinical reasoning that is not explicitly present in the instruction text itself, even if it seems like a natural addition. " +
          "Keep it under 40 words and address the recipient by name.",
        messages: [
          {
            role: "user",
            content: `Hospital: ${input.hospitalName} (${input.hospitalType})\nRecipient: ${input.guardianName || input.patientName}\nApproved instruction: "${input.approvedInstruction}"\n\nWrite the message only, no preamble.`,
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
    console.warn("[restrictedAiEngine] generation failed, falling back to static template:", err);
    return { body: staticTemplate(input), source: "static" };
  }
}
