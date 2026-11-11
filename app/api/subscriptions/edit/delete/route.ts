import { NextResponse } from "next/server";
import { requireUser } from "@/lib/route-auth";
import { storeFor } from "@/lib/store";
import { DeleteEditBody } from "@/lib/subscription-edit";

// Undo a correction, or remove a recurring payment the user added by hand.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const parsed = DeleteEditBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const store = await storeFor(auth.user);
  await store.deleteEdit(parsed.data.merchantKey);
  return NextResponse.json({ ok: true });
}
