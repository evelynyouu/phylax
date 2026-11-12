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
