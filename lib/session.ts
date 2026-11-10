import crypto from "node:crypto";
import { deriveKey } from "./crypto";

// Signed session cookie for the single local user. The payload is not secret (email and name),
// so it is signed with HMAC-SHA256, not encrypted. The key is derived from the app's token key.

export interface SessionUser {
  email: string;
  name: string;
}

export const SESSION_COOKIE = "sw_session";
export const SESSION_DAYS = 30;
const DAY_MS = 86400000;

export const DEMO_USER: SessionUser = { email: "demo@subwatch.local", name: "Demo account" };

export function isDemo(): boolean {
  return process.env.DATA_SOURCE === "fixtures";
}

export function sessionKey(): Buffer {
  return deriveKey("subwatch-session-v1");
}

function sign(payload: string, key: Buffer): string {
  return crypto.createHmac("sha256", key).update(payload).digest("base64url");
}

export function createSessionToken(user: SessionUser, key: Buffer, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ email: user.email, name: user.name, exp: now + SESSION_DAYS * DAY_MS })
  ).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

export function verifySessionToken(token: string | undefined, key: Buffer, now = Date.now()): SessionUser | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payload, sig] = parts;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.email !== "string" || typeof data.name !== "string" || typeof data.exp !== "number") return null;
    if (data.exp <= now) return null;
    return { email: data.email, name: data.name };
  } catch {
    return null;
  }
}

/** One owner per install: the first Google account to sign in. */
export function checkOwner(owner: string | null, email: string): boolean {
  return owner === null || owner.toLowerCase() === email.toLowerCase();
}

/** Session from a cookie value, or the demo user in demo mode. */
export function sessionFromCookie(value: string | undefined): SessionUser | null {
  if (isDemo()) return DEMO_USER;
  return verifySessionToken(value, sessionKey());
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 86400,
};
