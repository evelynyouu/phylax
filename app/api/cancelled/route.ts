import { NextResponse } from "next/server";
import { z } from "zod";
import { clearManualCancel, setManualCancel } from "@/lib/db";
import { guardMutation } from "@/lib/route-auth";

// "I've cancelled it": hides future charges until a newer receipt arrives (lib/resolve.ts).
const Body = z.object({ merchantKey: z.string().regex(/^[a-z0-9]{1,100}$/), undo: z.boolean().optional() });

export async function POST(req: Request) {
  const denied = guardMutation(req);
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (parsed.data.undo) clearManualCancel(parsed.data.merchantKey);
  else setManualCancel(parsed.data.merchantKey);
  return NextResponse.json({ ok: true });
}
