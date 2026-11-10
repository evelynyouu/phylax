import { NextResponse } from "next/server";
import { sameOrigin } from "./csrf";
import { SESSION_COOKIE, sessionFromCookie, type SessionUser } from "./session";

function cookieValue(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function userFromRequest(req: Request): SessionUser | null {
  return sessionFromCookie(cookieValue(req, SESSION_COOKIE));
}

/**
 * Guard for state-changing routes: same origin and a valid session. The proxy checks the
 * session too; this second check keeps each route safe on its own.
 */
export function guardMutation(req: Request): NextResponse | null {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!userFromRequest(req)) return NextResponse.json({ error: "signed out" }, { status: 401 });
  return null;
}
