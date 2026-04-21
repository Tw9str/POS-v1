import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose";
import { readFileSync } from "fs";
import { join } from "path";

// ─────────────────────────────────────────────
// Ed25519 License System
//
// Private key: signs tokens on server (env var, NEVER exposed)
// Public key:  verifies tokens on client + server (safe to bundle)
// ─────────────────────────────────────────────

export interface LicensePayload {
  merchantId: string;
  plan: string;
  expiresAt: string;
  issuedAt: string;
  /** Max staff allowed by plan */
  maxStaff: number;
  /** Max products allowed by plan */
  maxProducts: number;
}

export interface LicenseValidation {
  valid: boolean;
  daysLeft: number;
  inGrace: boolean;
  graceDaysLeft: number;
  payload: LicensePayload | null;
}

// ─── Plan limits ────────────────────────────

export const PLAN_LIMITS: Record<
  string,
  { maxStaff: number; maxProducts: number; label: string }
> = {
  FREE_TRIAL: { maxStaff: 2, maxProducts: 50, label: "Free Trial" },
  BASIC: { maxStaff: 2, maxProducts: 100, label: "Basic" },
  STANDARD: { maxStaff: 5, maxProducts: 10000, label: "Standard" },
  PREMIUM: { maxStaff: 100, maxProducts: 100000, label: "Premium" },
};

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.BASIC;
}

// ─── Key loading ────────────────────────────

let _privateKey: CryptoKey | null = null;
let _publicKey: CryptoKey | null = null;

async function getPrivateKey(): Promise<CryptoKey> {
  if (_privateKey) return _privateKey;
  const pem = process.env.LICENSE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!pem) throw new Error("LICENSE_PRIVATE_KEY env var is not set");
  _privateKey = await importPKCS8(pem, "EdDSA");
  return _privateKey;
}

async function getPublicKey(): Promise<CryptoKey> {
  if (_publicKey) return _publicKey;
  const pem = readFileSync(
    join(process.cwd(), "certificates", "license-public.pem"),
    "utf-8",
  );
  _publicKey = await importSPKI(pem, "EdDSA");
  return _publicKey;
}

// ─── Server: sign license token ─────────────

export async function generateLicenseToken(
  payload: LicensePayload,
): Promise<string> {
  const key = await getPrivateKey();
  const expiresAt = new Date(payload.expiresAt);
  // Token expires 7 days after license expiry (grace period)
  const graceEnd = new Date(expiresAt);
  graceEnd.setDate(graceEnd.getDate() + 7);

  return new SignJWT({
    mid: payload.merchantId,
    pln: payload.plan,
    exp_at: payload.expiresAt,
    iss_at: payload.issuedAt,
    ms: payload.maxStaff,
    mp: payload.maxProducts,
  })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuedAt()
    .setExpirationTime(graceEnd)
    .setSubject(payload.merchantId)
    .sign(key);
}

// ─── Server: verify license token ───────────

export async function verifyLicenseToken(
  token: string,
): Promise<LicensePayload | null> {
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["EdDSA"],
    });
    return {
      merchantId: payload.mid as string,
      plan: payload.pln as string,
      expiresAt: payload.exp_at as string,
      issuedAt: payload.iss_at as string,
      maxStaff: (payload.ms as number) ?? 2,
      maxProducts: (payload.mp as number) ?? 100,
    };
  } catch {
    return null;
  }
}

// ─── Validate license expiry ────────────────

export function isLicenseValid(
  payload: LicensePayload,
  gracePeriodDays: number = 7,
): LicenseValidation {
  const now = new Date();
  const expires = new Date(payload.expiresAt);
  const graceEnd = new Date(
    expires.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000,
  );

  const msLeft = expires.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  if (now < expires) {
    return { valid: true, daysLeft, inGrace: false, graceDaysLeft: 0, payload };
  }

  if (now < graceEnd) {
    const graceMsLeft = graceEnd.getTime() - now.getTime();
    const graceDaysLeft = Math.ceil(graceMsLeft / (1000 * 60 * 60 * 24));
    return { valid: true, daysLeft: 0, inGrace: true, graceDaysLeft, payload };
  }

  return {
    valid: false,
    daysLeft: 0,
    inGrace: false,
    graceDaysLeft: 0,
    payload,
  };
}

// ─── Public key JWK for client-side verification ──

let _publicJwk: Record<string, string> | null = null;

export function getPublicKeyJwk(): Record<string, string> {
  if (_publicJwk) return _publicJwk;
  const raw = readFileSync(
    join(process.cwd(), "certificates", "license-public.jwk.json"),
    "utf-8",
  );
  _publicJwk = JSON.parse(raw);
  return _publicJwk!;
}
