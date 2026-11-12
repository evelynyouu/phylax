import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORY_ORDER } from "@/lib/categories";
import { requireUser } from "@/lib/route-auth";
import { storeFor } from "@/lib/store";

const Body = z.object({
  merchantKey: z.string().regex(/^[a-z0-9]{1,100}$/),
  category: z.enum(CATEGORY_ORDER as [string, ...string[]]).nullable(),
});

// Choose a category for a merchant, or clear the choice with null to go back to the rules.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  const store = await storeFor(auth.user);
  await store.setCategory(parsed.data.merchantKey, parsed.data.category as Parameters<typeof store.setCategory>[1]);
  return NextResponse.json({ ok: true });
}
