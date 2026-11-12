import { NextResponse } from "next/server";
import { z } from "zod";
import { isCategory, type Category } from "@/lib/categories";
import { logError } from "@/lib/log";
import { requireUser } from "@/lib/route-auth";
import { storeFor } from "@/lib/store";

const FAILED = "Could not save the category. Please try again.";

const Body = z.object({
  merchantKey: z.string().regex(/^[a-z0-9]{1,100}$/),
  category: z.custom<Category>(isCategory).nullable(),
});

// Choose a category for a merchant, or clear the choice with null to go back to the rules.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  try {
    const store = await storeFor(auth.user);
    await store.setCategory(parsed.data.merchantKey, parsed.data.category);
  } catch (e) {
    logError("category save failed", e);
    return NextResponse.json({ error: FAILED }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
