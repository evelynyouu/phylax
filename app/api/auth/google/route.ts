import crypto from "node:crypto";
import { connection, NextResponse, type NextRequest } from "next/server";
import { authUrl, gmailConfigured } from "@/lib/gmail";

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 600,
  path: "/",
};

export async function GET(req: NextRequest) {
  await connection();
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  if (!gmailConfigured()) {
    return NextResponse.redirect(new URL("/signin?auth=not_configured", base));
  }
  const state = crypto.randomBytes(24).toString("hex");
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("oauth_state", state, cookieOpts);
  // Only a known label travels; the callback maps it to a fixed path.
  const next = req.nextUrl.searchParams.get("next");
  if (next === "signup" || next === "app") res.cookies.set("oauth_next", next, cookieOpts);
  return res;
}
