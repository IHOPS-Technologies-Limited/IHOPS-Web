import crypto from "crypto";

// Password-reset tokens: 32 random bytes (256 bits), hex-encoded. Only the
// SHA-256 hash is ever stored (Staff.passwordResetTokenHash); the raw token
// exists only in the emailed link. SHA-256 (not bcrypt) is correct here — the
// token is high-entropy random data, not a human-chosen password, so a fast
// hash is safe and lets us look the row up by hash directly.
export function generateResetToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Temporary password for the Super Admin "set a temporary password" action.
// Avoids look-alike characters (0/O, 1/l/I) because it is usually read out
// over a phone call or typed from a WhatsApp message.
const PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
export function generateTempPassword(length = 12): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += PW_ALPHABET[bytes[i] % PW_ALPHABET.length];
  // Guarantee at least one digit, one upper and one lower so it satisfies any
  // reasonable password rule a future validator adds.
  if (!/[0-9]/.test(out)) out = out.slice(0, -1) + "7";
  if (!/[A-Z]/.test(out)) out = "K" + out.slice(1);
  if (!/[a-z]/.test(out)) out = out.slice(0, 1) + "m" + out.slice(2);
  return out;
}

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
