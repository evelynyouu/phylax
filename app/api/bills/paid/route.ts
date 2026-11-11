import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/route-auth";
import { storeFor } from "@/lib/store";

// Bill keys are merchantKey|YYYY-MM-DD (see lib/calendar.ts billKey).
const BillKey = z.string().regex(/^[a-z0-9]{1,100}\|\d{4}-\d{2}-\d{2}$/);
const Body = z.object({ key: BillKey, undo: z.boolean().optional() });

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const store = await storeFor(auth.user);
  await store.setMark("paid", parsed.data.key, !parsed.data.undo);
  return NextResponse.json({ ok: true });
}
