import { randomBytes, createHash } from "crypto";

const CODE_LENGTH = 6;
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No 0/O/1/I to avoid confusion

export function generateAccessCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return `SH-${code}`;
}

/**
 * Deterministic SHA-256 digest of an access code.
 * Used as the DB lookup key — no salt, so identical inputs produce identical hashes.
 */
export function hashAccessCode(plainCode: string): string {
  return createHash("sha256")
    .update(plainCode.toUpperCase().trim())
    .digest("hex");
}
