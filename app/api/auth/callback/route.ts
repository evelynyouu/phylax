import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { gmailFailureRedirect } from "@/lib/auth-copy";
import { requestOrigin } from "@/lib/csrf";
import { getOptionalUser } from "@/lib/current-user";
import { connectGmailWithCode, exchangeGoogleCode, saveGmailGrant } from "@/lib/gmail";
import { logError } from "@/lib/log";
import { supabaseStore } from "@/lib/store/supabase";
import { supabaseServer } from "@/lib/supabase/server";
import { storeFor } from "@/lib/store";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Where to land after Google. Only these internal paths are allowed, never a value from the URL.
const NEXT: Record<string, string> = { signup: "/signup?step=3", app: "/app" };

// Gmail connection callback. It stores the Gmail connection for the signed-in Phylax user (any
// Gmail address they choose). Sign-in is Supabase's job (/auth/callback), except for sign-up with
// Google, where this one consent also creates the account from Google's ID token.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Google sends the browser here at APP_URL (the registered redirect URI), so the browser's host
  // is APP_URL's host. Read it from the request so an unset APP_URL does not land on localhost.
  const base = requestOrigin(req.headers, req.url);
  const nextLabel = req.cookies.get("oauth_next")?.value;
  const done = (to: URL) => {
    const res = NextResponse.redirect(to);
    res.cookies.delete("oauth_state");
    res.cookies.delete("oauth_next");
    return res;
  };
  // Every fail() is for a signed-in user, so it goes back to sign-up step 2 or /app, never
  // /signin (which sends signed-in visitors on to /app and would lose the message).
  const fail = (reason: string) => done(new URL(gmailFailureRedirect(nextLabel, reason), base));

  const user = await getOptionalUser();
  // Signed out is only expected from sign-up's one-step Google flow; anything else signs in first.
  if (!user && nextLabel !== "signup") return done(new URL("/signin", base));

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const expected = req.cookies.get("oauth_state")?.value;

  // Check the state first, so a link from another site cannot abort an in-progress connect.
  if (!state || !expected || !safeEqual(state, expected)) return fail("invalid_state");
  if (url.searchParams.get("error")) return fail("denied");
  if (!code) return fail("invalid_state");

  let result;
  try {
    if (user) {
      result = await connectGmailWithCode(code, await storeFor(user));
    } else {
      // Sign-up with Google: the same consent creates the Phylax account and connects Gmail.
      const grant = await exchangeGoogleCode(code);
      if (!grant.idToken || !grant.gmailEmail) return fail("no_identity");
      const supabase = await supabaseServer();
      const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: grant.idToken });
      if (error || !data.user) {
        logError("google sign-up: signInWithIdToken", error);
        return fail("signin_failed");
      }
      // The new session lives on this client; the request's cookies do not have it yet.
      result = await saveGmailGrant(grant, supabaseStore(supabase, data.user.id));
    }
  } catch {
    return fail("failed");
  }
  if (!result.ok) return fail(result.reason);

  return done(new URL(NEXT[nextLabel ?? ""] ?? "/app", base));
}
