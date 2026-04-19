import "server-only";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/** Hash a plaintext PIN with bcrypt. */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

/** Verify a plaintext PIN against a bcrypt hash. */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}
