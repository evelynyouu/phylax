import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/csrf";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // 303 so the browser follows the form POST with a GET.
  const res = NextResponse.redirect(new URL("/signin?auth=signed_out", process.env.APP_URL ?? req.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
