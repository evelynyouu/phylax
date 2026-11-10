import { NextResponse, type NextRequest } from "next/server";
import { gate } from "@/lib/gate";
import { SESSION_COOKIE, sessionFromCookie } from "@/lib/session";

// Optimistic gate for /app pages and API routes. Pages and route handlers check the session again.
export function proxy(request: NextRequest) {
  const signedIn = sessionFromCookie(request.cookies.get(SESSION_COOKIE)?.value) !== null;
  const decision = gate({ path: request.nextUrl.pathname, method: request.method, signedIn });
  if (decision === "signin") return NextResponse.redirect(new URL("/signin", request.url));
  if (decision === "unauthorized") return NextResponse.json({ error: "signed out" }, { status: 401 });
  return NextResponse.next();
}

export const config = {
  matcher: ["/app", "/app/:path*", "/api/:path*"],
};
