import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/route-auth";
import { storeFor } from "@/lib/store";

const Body = z.object({ merchantKey: z.string().min(1).max(100), undo: z.boolean().optional() });

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const store = await storeFor(auth.user);
  const key = parsed.data.merchantKey;
  await store.setMark("dismissed", key, !parsed.data.undo);
  // A payment the user added by hand has nothing to come back from; Stop tracking removes it.
  if (!parsed.data.undo && (await store.listEdits()).some((e) => e.merchantKey === key && e.manual)) await store.deleteEdit(key);
  return NextResponse.json({ ok: true });
}
