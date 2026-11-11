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
  await store.setMark("dismissed", parsed.data.merchantKey, !parsed.data.undo);
  return NextResponse.json({ ok: true });
}
