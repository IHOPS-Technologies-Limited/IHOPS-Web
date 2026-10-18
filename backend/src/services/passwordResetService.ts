import { prisma } from "../lib/prisma";
import { generateResetToken, PASSWORD_RESET_TTL_MS } from "../lib/secrets";
import { appUrl } from "../lib/appUrl";
import { sendEmail } from "./notificationService";

// Creates a one-time reset link for a staff account (replacing any earlier
// unused one) and, optionally, emails it. Used by both the public
// "Forgot password" flow and the Super Admin console.
//
// Returns the full URL so the Super Admin screen can show/copy it — useful
// when the client's email is down or the message lands in spam, because the
// link can then be sent over WhatsApp instead.
export async function issuePasswordReset(
  staff: { id: string; name: string; email: string | null },
  opts: { email: boolean } = { email: true },
): Promise<{ resetUrl: string; expiresAt: Date; emailed: boolean }> {
  const { token, tokenHash } = generateResetToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await prisma.staff.update({
    where: { id: staff.id },
    data: { passwordResetTokenHash: tokenHash, passwordResetExpires: expiresAt },
  });

  const resetUrl = appUrl(`/reset-password?token=${token}`);

  let emailed = false;
  if (opts.email && staff.email) {
    const result = await sendEmail(
      staff.email,
      "Reset your IHOPS password",
      `Hello ${staff.name},\n\nWe received a request to reset the password for your IHOPS account. Click the link below to choose a new one — it works once and expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't ask for this, you can safely ignore this email; your password stays exactly as it is.\n\nThe IHOPS Team`,
    );
    emailed = result?.ok !== false;
  }
  return { resetUrl, expiresAt, emailed };
}
