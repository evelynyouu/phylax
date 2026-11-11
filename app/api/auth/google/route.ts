import crypto from "node:crypto";
import { connection, NextResponse, type NextRequest } from "next/server";
import { gmailFailureRedirect } from "@/lib/auth-copy";
import { getOptionalUser } from "@/lib/current-user";
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
  // Gmail belongs to a Subwatch account: sign in first, then connect.
  if (!(await getOptionalUser())) return NextResponse.redirect(new URL("/signin", base));
  // Only a known label travels; the callback maps it to a fixed path.
  const next = req.nextUrl.searchParams.get("next");
  if (!gmailConfigured()) {
    // Signed in, so /signin would bounce to /app and drop the message.
    return NextResponse.redirect(new URL(gmailFailureRedirect(next ?? undefined, "not_configured"), base));
  }
  const state = crypto.randomBytes(24).toString("hex");
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("oauth_state", state, cookieOpts);
  if (next === "signup" || next === "app") res.cookies.set("oauth_next", next, cookieOpts);
  return res;
}
