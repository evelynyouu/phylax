import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth-copy";
import { isDemo } from "@/lib/session";
import { supabaseEnv } from "@/lib/supabase/config";
import { supabaseServer } from "@/lib/supabase/server";

// Supabase sends Google sign-ins (and email confirmation links) here with a PKCE code.
// Exchanging it sets the session cookies; then we go to a whitelisted next path.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // The session cookies are set on the request's host, so stay on it. APP_URL could name a
  // different host (127.0.0.1 vs localhost) where those cookies do not exist.
  const base = url.origin;
  const next = safeNext(url.searchParams.get("next"));
  if (isDemo()) return NextResponse.redirect(new URL(next, base));

  const fail = (reason: string) => NextResponse.redirect(new URL(`/signin?auth=${reason}`, base));
  if (!supabaseEnv()) return fail("accounts_not_configured");
  if (url.searchParams.get("error")) return fail("denied");
  const code = url.searchParams.get("code");
  if (!code) return fail("failed");

  const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
  if (error) return fail("failed");
  return NextResponse.redirect(new URL(next, base));
}
