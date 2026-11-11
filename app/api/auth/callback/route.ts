import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/current-user";
import { connectGmailWithCode } from "@/lib/gmail";
import { storeFor } from "@/lib/store";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Where to land after Google. Only these internal paths are allowed, never a value from the URL.
const NEXT: Record<string, string> = { signup: "/signup?step=3", app: "/app" };

// Gmail connection callback. Signing in is Supabase's job (/auth/callback); this only stores
// the Gmail connection, for the signed-in Subwatch user (any Gmail address they choose).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const base = process.env.APP_URL ?? url.origin;
  const done = (to: URL) => {
    const res = NextResponse.redirect(to);
    res.cookies.delete("oauth_state");
    res.cookies.delete("oauth_next");
    return res;
  };
  const fail = (reason: string) => {
    const to = new URL("/signin", base);
    to.searchParams.set("auth", reason);
    return done(to);
  };

  const user = await getOptionalUser();
  if (!user) return done(new URL("/signin", base));

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const expected = req.cookies.get("oauth_state")?.value;

  if (url.searchParams.get("error")) return fail("denied");
  if (!state || !code || !expected || !safeEqual(state, expected)) return fail("invalid_state");

  let result;
  try {
    result = await connectGmailWithCode(code, await storeFor(user));
  } catch {
    return fail("failed");
  }
  if (!result.ok) return fail(result.reason);

  return done(new URL(NEXT[req.cookies.get("oauth_next")?.value ?? ""] ?? "/app", base));
}
