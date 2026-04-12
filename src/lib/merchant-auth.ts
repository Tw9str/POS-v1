import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "merchant_session";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export interface MerchantCacheData {
  id: string;
  name: string;
  currency: string;
  taxRate: number;
  phone: string | null;
  address: string | null;
  numberFormat: string;
  dateFormat: string;
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return secret;
}

function sign(data: MerchantCacheData): string {
  const payload = JSON.stringify(data);
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(encoded).digest("hex");
  return `${encoded}.${sig}`;
}

function verify(token: string): MerchantCacheData | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;

  const encoded = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);

  const expected = createHmac("sha256", getSecret())
    .update(encoded)
    .digest("hex");

  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  try {
    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const data = JSON.parse(payload) as MerchantCacheData;
    if (!data.id || !data.name) return null;
    return data;
  } catch {
    return null;
  }
}

export async function setMerchantSession(
  data: MerchantCacheData,
): Promise<void> {
  const token = sign(data);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getMerchantSession(): Promise<MerchantCacheData | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  // Support new format (JSON payload)
  const data = verify(cookie.value);
  if (data) return data;

  // Legacy support: old cookies that only had merchantId
  return migrateOldCookie(cookie.value);
}

/** Handle old-format cookies that stored just the merchantId */
function migrateOldCookie(token: string): MerchantCacheData | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;

  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);

  // Old format: payload was a plain merchantId (UUID-like, no base64)
  if (payload.includes("{") || payload.includes("[")) return null;

  const expected = createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  // Return partial data · the DB call in getMerchantFromSession will fill in the rest
  return {
    id: payload,
    name: "",
    currency: "SYP",
    taxRate: 0,
    phone: null,
    address: null,
    numberFormat: "western",
    dateFormat: "long",
  };
}

export async function clearMerchantSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
