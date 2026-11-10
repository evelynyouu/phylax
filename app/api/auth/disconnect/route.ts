import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/route-auth";
import { disconnect } from "@/lib/gmail";
import { SESSION_COOKIE } from "@/lib/session";


export async function POST(req: Request) {
  const denied = guardMutation(req);
  if (denied) return denied;
  await disconnect();
  // Disconnecting Gmail also ends the session: the install no longer has an owner.
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
