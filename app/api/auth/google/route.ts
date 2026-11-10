import crypto from "node:crypto";
import { connection, NextResponse } from "next/server";
import { authUrl, gmailConfigured } from "@/lib/gmail";

export async function GET() {
  await connection();
  if (!gmailConfigured()) {
    return NextResponse.redirect(new URL("/?auth=not_configured", process.env.APP_URL ?? "http://localhost:3000"));
  }
  const state = crypto.randomBytes(24).toString("hex");
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
