import { NextResponse } from "next/server";
import { disconnect } from "@/lib/gmail";
import { requireUser } from "@/lib/route-auth";
import { storeFor } from "@/lib/store";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  await disconnect(await storeFor(auth.user));
  return NextResponse.json({ ok: true });
}
