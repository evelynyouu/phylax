import { NextResponse } from "next/server";
import { z } from "zod";
import { guardMutation } from "@/lib/route-auth";
import { dismissMerchant, undismissMerchant } from "@/lib/db";


const Body = z.object({ merchantKey: z.string().min(1).max(100), undo: z.boolean().optional() });

export async function POST(req: Request) {
  const denied = guardMutation(req);
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (parsed.data.undo) undismissMerchant(parsed.data.merchantKey);
  else dismissMerchant(parsed.data.merchantKey);
  return NextResponse.json({ ok: true });
}
