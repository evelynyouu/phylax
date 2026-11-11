import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/route-auth";
import { storeFor } from "@/lib/store";

// "I've cancelled it": hides future charges until a newer receipt arrives (lib/resolve.ts).
const Body = z.object({ merchantKey: z.string().regex(/^[a-z0-9]{1,100}$/), undo: z.boolean().optional() });

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const store = await storeFor(auth.user);
  await store.setMark("manual_cancels", parsed.data.merchantKey, !parsed.data.undo);
  return NextResponse.json({ ok: true });
}
