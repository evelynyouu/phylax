import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth-copy";
import { requestOrigin } from "@/lib/csrf";
import { supabaseEnv } from "@/lib/supabase/config";
import { supabaseServer } from "@/lib/supabase/server";

// Supabase sends Google sign-ins (and email confirmation links) here with a PKCE code.
// Exchanging it sets the session cookies; then we go to a whitelisted next path.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // The session cookies are set on the browser's host, so stay on it. APP_URL could name a
  // different host (127.0.0.1 vs localhost), and under next start req.url says localhost even
  // when the browser used 127.0.0.1, so read the Host header.
  const base = requestOrigin(req.headers, req.url);
  const next = safeNext(url.searchParams.get("next"));
  const fail = (reason: string) => NextResponse.redirect(new URL(`/signin?auth=${reason}`, base));
  if (!supabaseEnv()) return fail("accounts_not_configured");
  if (url.searchParams.get("error")) return fail("denied");
  const code = url.searchParams.get("code");
  if (!code) {
    // Secure email change: the first of the two confirmation links returns here without a code.
    // That is not a failure; land on Settings (or the whitelisted next) and say what happened.
    const target = new URL(next, base);
    if (next === "/app/settings") target.searchParams.set("email", url.searchParams.has("message") ? "pending" : "changed");
    return NextResponse.redirect(target);
  }

  const settings = (email: "changed" | "check") => NextResponse.redirect(new URL(`/app/settings?email=${email}`, base));
  const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
  if (error) {
    // An email change link opened on another device has no code verifier, so the exchange fails
    // even though the email may already be changed. Say so on Settings; the proxy still sends a
    // signed-out browser to sign in.
    if (next === "/app/settings") return settings("check");
    return fail("failed");
  }
  if (next === "/app/settings") return settings("changed");
  return NextResponse.redirect(new URL(next, base));
}
