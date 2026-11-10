import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/csrf";
import { disconnect } from "@/lib/gmail";


export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await disconnect();
  return NextResponse.json({ ok: true });
}
