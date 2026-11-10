import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { saveTokensFromCode } from "@/lib/gmail";


function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const home = new URL("/", process.env.APP_URL ?? url.origin);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const expected = req.cookies.get("oauth_state")?.value;

  if (url.searchParams.get("error")) {
    home.searchParams.set("auth", "denied");
    return NextResponse.redirect(home);
  }
  if (!state || !code || !expected || !safeEqual(state, expected)) {
    home.searchParams.set("auth", "invalid_state");
    return NextResponse.redirect(home);
  }

  try {
    await saveTokensFromCode(code);
    home.searchParams.set("auth", "connected");
  } catch {
    home.searchParams.set("auth", "failed");
  }
  const res = NextResponse.redirect(home);
  res.cookies.delete("oauth_state");
  return res;
}
