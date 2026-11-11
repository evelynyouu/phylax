import { NextResponse } from "next/server";
import { disconnect } from "@/lib/gmail";
import { requireUser } from "@/lib/route-auth";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  await disconnect();
  return NextResponse.json({ ok: true });
}
