import { NextResponse } from "next/server";
import { z } from "zod";
import { markPaid, unmarkPaid } from "@/lib/db";
import { requireUser } from "@/lib/route-auth";

// Bill keys are merchantKey|YYYY-MM-DD (see lib/calendar.ts billKey).
const BillKey = z.string().regex(/^[a-z0-9]{1,100}\|\d{4}-\d{2}-\d{2}$/);
const Body = z.object({ key: BillKey, undo: z.boolean().optional() });

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (parsed.data.undo) unmarkPaid(parsed.data.key);
  else markPaid(parsed.data.key);
  return NextResponse.json({ ok: true });
}
