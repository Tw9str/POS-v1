/**
 * Client-side license verification.
 *
 * Uses the Ed25519 public key (safe to bundle) to verify license tokens
 * locally via JWT. The private key never leaves the server.
 */
import { jwtVerify, importJWK } from "jose";

const LICENSE_KEY = "shampay:license";
const PUBLIC_KEY_KEY = "shampay:licensePublicKey";

export interface ClientLicenseData {
  token: string;
  merchantId: string;
  plan: string;
  expiresAt: string;
  maxStaff: number;
  maxProducts: number;
  fetchedAt: number;
}

export interface ClientLicenseStatus {
  valid: boolean;
  daysLeft: number;
  inGrace: boolean;
  plan: string;
  expiresAt: string;
  maxStaff: number;
  maxProducts: number;
  reason?: string;
}

// ─── Store / Retrieve license from localStorage ──

function storeLicense(data: ClientLicenseData): void {
  try {
    localStorage.setItem(LICENSE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable
  }
}

function storePublicKey(jwk: Record<string, string>): void {
  try {
    localStorage.setItem(PUBLIC_KEY_KEY, JSON.stringify(jwk));
  } catch {
    // Storage full or unavailable
  }
}

function getStoredLicense(): ClientLicenseData | null {
  try {
    const raw = localStorage.getItem(LICENSE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getStoredPublicKey(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(PUBLIC_KEY_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Verify cached license token client-side ───────

export async function verifyCachedLicense(): Promise<ClientLicenseStatus> {
  const stored = getStoredLicense();
  if (!stored?.token) {
    return {
      valid: false,
      daysLeft: 0,
      inGrace: false,
      plan: "",
      expiresAt: "",
      maxStaff: 0,
      maxProducts: 0,
      reason: "no_license",
    };
  }

  const jwk = getStoredPublicKey();
  if (!jwk) {
    return {
      valid: false,
      daysLeft: 0,
      inGrace: false,
      plan: "",
      expiresAt: "",
      maxStaff: 0,
      maxProducts: 0,
      reason: "no_public_key",
    };
  }

  try {
    const key = await importJWK(jwk, "EdDSA");
    const { payload } = await jwtVerify(stored.token, key, {
      algorithms: ["EdDSA"],
    });

    const expiresAt = payload.exp_at as string;
    const plan = payload.pln as string;
    const maxStaff = (payload.ms as number) ?? 2;
    const maxProducts = (payload.mp as number) ?? 100;

    const now = new Date();
    const expires = new Date(expiresAt);
    const graceEnd = new Date(expires);
    graceEnd.setDate(graceEnd.getDate() + 7);

    const msLeft = expires.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    if (now < expires) {
      return {
        valid: true,
        daysLeft,
        inGrace: false,
        plan,
        expiresAt,
        maxStaff,
        maxProducts,
      };
    }

    if (now < graceEnd) {
      return {
        valid: true,
        daysLeft: 0,
        inGrace: true,
        plan,
        expiresAt,
        maxStaff,
        maxProducts,
      };
    }

    return {
      valid: false,
      daysLeft: 0,
      inGrace: false,
      plan,
      expiresAt,
      maxStaff,
      maxProducts,
      reason: "expired",
    };
  } catch {
    return {
      valid: false,
      daysLeft: 0,
      inGrace: false,
      plan: "",
      expiresAt: "",
      maxStaff: 0,
      maxProducts: 0,
      reason: "invalid_token",
    };
  }
}

// ─── Fetch license from server & cache locally ──

export async function fetchAndCacheLicense(): Promise<ClientLicenseStatus> {
  try {
    const res = await fetch("/api/merchant/license");
    if (!res.ok) {
      return verifyCachedLicense();
    }

    const data = await res.json();

    if (data.publicKey) {
      storePublicKey(data.publicKey);
    }

    if (data.token) {
      storeLicense({
        token: data.token,
        merchantId: data.merchantId ?? "",
        plan: data.plan ?? "",
        expiresAt: data.expiresAt ?? "",
        maxStaff: data.maxStaff ?? 2,
        maxProducts: data.maxProducts ?? 100,
        fetchedAt: Date.now(),
      });
    }

    if (!data.valid) {
      return {
        valid: false,
        daysLeft: 0,
        inGrace: false,
        plan: data.plan ?? "",
        expiresAt: data.expiresAt ?? "",
        maxStaff: data.maxStaff ?? 0,
        maxProducts: data.maxProducts ?? 0,
        reason: data.reason ?? "no_license",
      };
    }

    return {
      valid: true,
      daysLeft: data.daysLeft ?? 0,
      inGrace: data.inGrace ?? false,
      plan: data.plan ?? "",
      expiresAt: data.expiresAt ?? "",
      maxStaff: data.maxStaff ?? 2,
      maxProducts: data.maxProducts ?? 100,
    };
  } catch {
    return verifyCachedLicense();
  }
}
