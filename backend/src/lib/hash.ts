import bcrypt from "bcryptjs";

export async function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function compareSecret(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
