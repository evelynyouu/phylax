import { NextResponse } from "next/server";
import { requireUser } from "@/lib/route-auth";
import { storeFor } from "@/lib/store";
import { parseEdit } from "@/lib/subscription-edit";

// Save a correction to a subscription, or add a recurring payment by hand.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const result = parseEdit(await req.json().catch(() => null));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const store = await storeFor(auth.user);
  await store.saveEdit(result.edit);
  return NextResponse.json({ ok: true, merchantKey: result.edit.merchantKey });
}
