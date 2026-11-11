import { NextResponse } from "next/server";
import { sameOrigin } from "./csrf";
import { getOptionalUser, type AppUser } from "./current-user";

/**
 * Guard for state-changing routes: same origin, then a session Supabase verifies. The proxy
 * checks the session too; this second check keeps each route safe on its own.
 */
export async function requireUser(req: Request): Promise<{ user: AppUser } | { denied: NextResponse }> {
  if (!sameOrigin(req)) return { denied: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  const user = await getOptionalUser();
  if (!user) return { denied: NextResponse.json({ error: "signed out" }, { status: 401 }) };
  return { user };
}
