import crypto from "node:crypto";
import { connection, NextResponse, type NextRequest } from "next/server";
import { gmailFailureRedirect } from "@/lib/auth-copy";
import { requestOrigin } from "@/lib/csrf";
import { getOptionalUser } from "@/lib/current-user";
import { authUrl, gmailConfigured, SCOPES, SIGNUP_SCOPES } from "@/lib/gmail";

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 600,
  path: "/",
};

export async function GET(req: NextRequest) {
  await connection();
  // Redirects that stay in Phylax go to the browser's host, where its session lives. Only the
  // Google redirect URI (lib/gmail.ts oauthClient) uses APP_URL.
  const base = requestOrigin(req.headers, req.url);
  // Only a known label travels; the callback maps it to a fixed path.
  const next = req.nextUrl.searchParams.get("next");
  // Gmail belongs to a Phylax account. The one exception is sign-up: a signed-out visitor there
  // gets one Google screen that creates the account (from the ID token) and connects Gmail.
  const signedIn = !!(await getOptionalUser());
  if (!signedIn && next !== "signup") return NextResponse.redirect(new URL("/signin", base));
  if (!gmailConfigured()) {
    // Signed in, so /signin would bounce to /app and drop the message.
    return NextResponse.redirect(new URL(gmailFailureRedirect(next ?? undefined, "not_configured"), base));
  }
  const state = crypto.randomBytes(24).toString("hex");
  const res = NextResponse.redirect(authUrl(state, signedIn ? SCOPES : SIGNUP_SCOPES));
  res.cookies.set("oauth_state", state, cookieOpts);
  if (next === "signup" || next === "app") res.cookies.set("oauth_next", next, cookieOpts);
  return res;
}
