import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "staff_session";
const MAX_AGE = 12 * 60 * 60; // 12 hours (shift-length)

interface StaffPayload {
  staffId: string;
  merchantId: string;
  role: string;
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return secret;
}

function sign(payload: StaffPayload): string {
  const data = `${payload.staffId}:${payload.merchantId}:${payload.role}`;
  const sig = createHmac("sha256", getSecret()).update(data).digest("hex");
  return `${data}.${sig}`;
}

function verify(token: string): StaffPayload | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;

  const data = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);

  const expected = createHmac("sha256", getSecret()).update(data).digest("hex");

  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  const parts = data.split(":");
  if (parts.length !== 3) return null;

  return {
    staffId: parts[0],
    merchantId: parts[1],
    role: parts[2],
  };
}

export async function setStaffSession(payload: StaffPayload): Promise<void> {
  const token = sign(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getStaffSession(): Promise<StaffPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return verify(cookie.value);
}

export async function clearStaffSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
