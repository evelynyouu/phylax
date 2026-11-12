import { NextResponse } from "next/server";
import { requireUser } from "@/lib/route-auth";
import { storeFor } from "@/lib/store";
import { isEmptyEdit } from "@/lib/save-payment";
import { mergeEdit, parseEdit } from "@/lib/subscription-edit";

// Save a correction to a subscription, or add a recurring payment by hand.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const body = await req.json().catch(() => null);
  const result = parseEdit(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const key = result.edit.merchantKey;
  // An edit that changes no field would save an empty row and tag the subscription Edited.
  if (isEmptyEdit(result.edit)) return NextResponse.json({ ok: true, merchantKey: key });
  const store = await storeFor(auth.user);
  const stored = (await store.listEdits()).find((e) => e.merchantKey === key);
  // A body without merchantKey is a new payment added from the form.
  const adding = !(body && typeof body === "object" && "merchantKey" in body);
  if (adding) {
    if (stored?.manual) {
      return NextResponse.json({ error: `You already added ${stored.merchant ?? "this payment"}. Open it to edit it.` }, { status: 400 });
    }
    // Adding a payment by hand means the user wants it tracked, even if they stopped tracking it before.
    await store.setMark("dismissed", key, false);
  }
  await store.saveEdit(mergeEdit(stored, result.edit));
  return NextResponse.json({ ok: true, merchantKey: key });
}
