import { NextResponse } from "next/server";
import { disconnect } from "@/lib/gmail";
import { requireUser } from "@/lib/route-auth";
import { storeFor } from "@/lib/store";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  // revokeFailed: Subwatch dropped its copy, but Google may still list the grant
  // (the user can remove it at https://myaccount.google.com/permissions).
  const { revokeFailed } = await disconnect(await storeFor(auth.user));
  return NextResponse.json({ ok: true, revokeFailed });
}
