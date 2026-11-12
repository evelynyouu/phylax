import type { Category } from "./categories";

type Post = (url: string, body: unknown) => Promise<Response>;

export type AddResult =
  | { ok: true; merchantKey: string }
  | { ok: false; stage: "payment"; error: string }
  | { ok: false; stage: "category"; error: string; merchantKey: string };

async function errorOf(res: Response, fallback: string): Promise<string> {
  return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? fallback;
}

/**
 * Add a payment by hand, then save the chosen category (empty means "pick for me", so no call).
 * Pass `addedKey` to retry only the category after the payment was already saved, so it is never added twice.
 */
export async function addThenCategorize(post: Post, editBody: unknown, category: Category | "", addedKey?: string): Promise<AddResult> {
  let merchantKey = addedKey;
  if (!merchantKey) {
    try {
      const res = await post("/api/subscriptions/edit", editBody);
      if (!res.ok) return { ok: false, stage: "payment", error: await errorOf(res, "Could not save") };
      merchantKey = ((await res.json().catch(() => ({}))) as { merchantKey?: string }).merchantKey;
    } catch {
      return { ok: false, stage: "payment", error: "Could not save" };
    }
    if (!merchantKey) return { ok: true, merchantKey: "" };
  }
  if (!category) return { ok: true, merchantKey };
  try {
    const res = await post("/api/categories", { merchantKey, category });
    if (!res.ok) return { ok: false, stage: "category", merchantKey, error: await errorOf(res, "Could not save the category") };
  } catch {
    return { ok: false, stage: "category", merchantKey, error: "Could not save the category" };
  }
  return { ok: true, merchantKey };
}

type EditFields = { merchantKey?: string; merchant?: unknown; amount?: unknown; currency?: unknown; cadence?: unknown; nextChargeDate?: unknown; manual?: boolean };

/** True when an edit of an email-found subscription changes no field (a manual payment always counts as a change). */
export function isEmptyEdit(b: EditFields): boolean {
  return b.manual !== true && [b.merchant, b.amount, b.currency, b.cadence, b.nextChargeDate].every((v) => v == null);
}

/**
 * Save an edit, then the category when it changed. An edit that changes no field is not sent, so a
 * category-only change does not mark the subscription as Edited.
 */
export async function editThenCategorize(
  post: Post,
  editBody: EditFields & { merchantKey: string },
  category: Category | "",
  previous: Category,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isEmptyEdit(editBody)) {
      const res = await post("/api/subscriptions/edit", editBody);
      if (!res.ok) return { ok: false, error: await errorOf(res, "Could not save") };
    }
    if (category && category !== previous) {
      const res = await post("/api/categories", { merchantKey: editBody.merchantKey, category });
      if (!res.ok) return { ok: false, error: await errorOf(res, "Could not save the category") };
    }
  } catch {
    return { ok: false, error: "Could not save" };
  }
  return { ok: true };
}
