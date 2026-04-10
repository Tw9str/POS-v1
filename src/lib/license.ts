import jwt from "jsonwebtoken";

const LICENSE_SECRET = process.env.LICENSE_SECRET || "fallback-secret";

export interface LicensePayload {
  merchantId: string;
  plan: string;
  expiresAt: string;
  issuedAt: string;
}

export function generateLicenseToken(payload: LicensePayload): string {
  return jwt.sign(payload, LICENSE_SECRET, { algorithm: "HS256" });
}

export function verifyLicenseToken(token: string): LicensePayload | null {
  try {
    return jwt.verify(token, LICENSE_SECRET) as LicensePayload;
  } catch {
    return null;
  }
}

export function generateActivationCode(
  merchantId: string,
  expiresAt: Date
): string {
  const payload = `${merchantId}:${expiresAt.getTime()}`;
  const token = jwt.sign({ d: payload }, LICENSE_SECRET, {
    algorithm: "HS256",
    expiresIn: "45d",
  });
  // Short code from last 8 chars of base64
  const code = Buffer.from(token).toString("base64").slice(-12).toUpperCase();
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

export function isLicenseValid(payload: LicensePayload): {
  valid: boolean;
  daysLeft: number;
  inGrace: boolean;
} {
  const now = new Date();
  const expires = new Date(payload.expiresAt);
  const graceEnd = new Date(expires);
  graceEnd.setDate(graceEnd.getDate() + 7); // 7 day grace

  const msLeft = expires.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  if (now < expires) {
    return { valid: true, daysLeft, inGrace: false };
  }

  if (now < graceEnd) {
    return { valid: true, daysLeft: 0, inGrace: true };
  }

  return { valid: false, daysLeft: 0, inGrace: false };
}
