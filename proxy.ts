import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { gate } from "@/lib/gate";
import { isDemo } from "@/lib/session";
import { supabaseEnv } from "@/lib/supabase/config";

// Refreshes the Supabase session cookies on every matched request (the @supabase/ssr
// updateSession pattern), then gates /app pages and API routes. Pages and route handlers
// check the user again. Demo mode never touches Supabase.
export async function proxy(request: NextRequest) {
  if (isDemo()) return decide(request, true, NextResponse.next());

  let response = NextResponse.next({ request });
  let signedIn = false;
  const env = supabaseEnv();
  if (env) {
    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list, headers) {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
          for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
        },
      },
    });
    try {
      const { data } = await supabase.auth.getUser();
      signedIn = data.user !== null;
    } catch {
      // Supabase unreachable: treat as signed out rather than fail the request.
    }
  }
  return decide(request, signedIn, response);
}

function decide(request: NextRequest, signedIn: boolean, response: NextResponse): NextResponse {
  const decision = gate({ path: request.nextUrl.pathname, method: request.method, signedIn });
  if (decision === "next") return response;
  const out =
    decision === "signin"
      ? NextResponse.redirect(new URL("/signin", request.url))
      : NextResponse.json({ error: "signed out" }, { status: 401 });
  // Keep any cookie changes (a cleared or refreshed session) and their no-cache header on the redirect or 401.
  for (const c of response.cookies.getAll()) out.cookies.set(c);
  for (const h of ["cache-control", "expires", "pragma"]) {
    const v = response.headers.get(h);
    if (v) out.headers.set(h, v);
  }
  return out;
}

export const config = {
  matcher: ["/app", "/app/:path*", "/api/:path*", "/signin", "/signup"],
};
