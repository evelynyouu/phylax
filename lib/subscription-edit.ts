import { z } from "zod";
import { merchantKey as toMerchantKey } from "./extract/merchant";
import type { SubscriptionEdit } from "./store/types";

// Input rules for editing a subscription or adding one by hand. Shared by the API route and the form.

export const EDIT_MESSAGES = {
  name: "Enter a name of 1 to 80 characters.",
  amount: "Enter an amount above 0 and up to 100,000, with at most 2 decimals.",
  cycle: "Choose a billing cycle: weekly, monthly, quarterly or yearly.",
  date: "Enter the next charge date as a real date (YYYY-MM-DD).",
  currency: "Choose a currency: USD, EUR or GBP.",
} as const;

const KEY = /^[a-z0-9]{1,100}$/;

function realDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const Body = z.object({
  merchantKey: z.string().regex(KEY).optional(),
  merchant: z.string().trim().min(1, EDIT_MESSAGES.name).max(80, EDIT_MESSAGES.name).nullable().optional(),
  amount: z
    .number({ message: EDIT_MESSAGES.amount })
    // Floating point: 17.99 * 100 is 1798.9999..., so compare with a tolerance instead of ===.
    .refine((n) => n > 0 && n <= 100000 && Math.abs(Math.round(n * 100) - n * 100) < 1e-6, EDIT_MESSAGES.amount)
    .nullable()
    .optional(),
  currency: z.enum(["USD", "EUR", "GBP"], { message: EDIT_MESSAGES.currency }).nullable().optional(),
  cadence: z.enum(["weekly", "monthly", "quarterly", "yearly"], { message: EDIT_MESSAGES.cycle }).nullable().optional(),
  nextChargeDate: z.string().refine(realDate, EDIT_MESSAGES.date).nullable().optional(),
  manual: z.boolean().optional(),
});

export type EditResult = { ok: true; edit: Omit<SubscriptionEdit, "updatedAt"> } | { ok: false; error: string };

/** Validates a request body. A manual entry needs a name and gets its key from it. */
export function parseEdit(body: unknown): EditResult {
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // A malformed merchantKey is not something a person typed; keep its message generic.
    if (issue?.path[0] === "merchantKey") return { ok: false, error: "bad request" };
    return { ok: false, error: issue?.message ?? "bad request" };
  }
  const b = parsed.data;
  const manual = b.manual === true;
  const merchant = b.merchant ?? null;
  if (manual && !merchant) return { ok: false, error: EDIT_MESSAGES.name };
  const key = b.merchantKey ?? (merchant ? toMerchantKey(merchant) : "");
  if (!KEY.test(key)) return { ok: false, error: manual ? EDIT_MESSAGES.name : "bad request" };
  return {
    ok: true,
    edit: {
      merchantKey: key,
      merchant,
      amount: b.amount ?? null,
      currency: b.currency ?? (manual ? "USD" : null),
      cadence: b.cadence ?? null,
      nextChargeDate: b.nextChargeDate ?? null,
      manual,
    },
  };
}

export const DeleteEditBody = z.object({ merchantKey: z.string().regex(KEY) });
