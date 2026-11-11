import { describe, expect, it } from "vitest";
import { attentionItems, categoryTotals, dailySeries, subscriptionSubtitle } from "../lib/views";
import type { Dashboard, DueItem, Subscription } from "../lib/types";

const TODAY = "2026-11-09";

const sub = (over: Partial<Subscription>): Subscription => ({
  merchantKey: "netflix",
  merchant: "Netflix",
  status: "active",
  amount: 15.49,
  currency: "USD",
  cadence: "monthly",
  lastChargeDate: "2026-10-14",
  nextChargeDate: "2026-11-14",
  priceChange: null,
  cancelUrl: null,
  cancelUrlTrusted: false,
  evidenceEmailIds: ["a", "b", "c"],
  annualCost: 185.88,
  manualCancel: false,
  edited: false,
  manual: false,
  ...over,
});

const due = (over: Partial<DueItem>): DueItem => ({
  key: "k",
  merchant: "Hulu",
  merchantKey: "hulu",
  label: "Free trial ends",
  amount: 9.99,
  currency: "USD",
  date: "2026-11-12",
  daysAway: 3,
  kind: "trial_ending",
  cancelUrl: null,
  cancelUrlTrusted: false,
  paid: false,
  reminder: false,
  ...over,
});

const dash = (over: Partial<Dashboard>): Dashboard => ({
  generatedAt: "",
  subscriptions: [],
  upcoming: [],
  due: [],
  bills: [],
  receipts: [],
  totals: { monthly: 0, yearly: 0, count: 0 },
  ...over,
});

describe("needs attention", () => {
  it("includes trials and renewals within a week, not later ones", () => {
    const d = dash({
      due: [
        due({ key: "t", daysAway: 3 }),
        due({ key: "r", kind: "renewal_notice", label: "Auto-renews", merchant: "Peacock", daysAway: 1, date: "2026-11-10" }),
        due({ key: "late", kind: "renewal_notice", label: "Auto-renews", daysAway: 20, date: "2026-11-29" }),
      ],
    });
    expect(attentionItems(d, TODAY).map((a) => a.key)).toEqual(["r", "t"]);
  });

  it("shows bills only when overdue or reminded within two days, and never once paid", () => {
    const bill = (key: string, daysAway: number, extra: Partial<DueItem> = {}) =>
      due({ key, kind: "payment_due", label: "Payment due", daysAway, date: "2026-11-20", ...extra });
    const d = dash({
      due: [
        bill("plain", 1),
        bill("overdue", -2),
        bill("reminded", 2, { reminder: true }),
        bill("reminded-far", 5, { reminder: true }),
        bill("paid-overdue", -2, { paid: true }),
      ],
    });
    expect(attentionItems(d, TODAY).map((a) => a.key).sort()).toEqual(["overdue", "reminded"]);
  });

  it("lists recent and upcoming price changes", () => {
    const d = dash({
      subscriptions: [
        sub({ merchantKey: "spotify", merchant: "Spotify", priceChange: { from: 11.99, to: 12.99, effective: "2026-10-03" } }),
        sub({ merchantKey: "duolingo", merchant: "Duolingo", priceChange: { from: 12.99, to: 14.99, effective: "2026-12-01" } }),
      ],
    });
    const titles = attentionItems(d, TODAY).map((a) => a.title);
    expect(titles).toContain("Duolingo price rises Dec 1");
    expect(titles).toContain("Spotify went up in October");
  });
});

describe("category totals", () => {
  it("sums active subscriptions a month by category, leaving out trials and cancelled", () => {
    const d = dash({
      subscriptions: [
        sub({}),
        sub({ merchantKey: "hulu", status: "trial", annualCost: 119.88 }),
        sub({ merchantKey: "openai", annualCost: 240 }),
        sub({ merchantKey: "peacock", status: "cancelled", annualCost: 95.88 }),
      ],
    });
    expect(categoryTotals(d)).toEqual([
      { category: "software", label: "Software and AI", monthly: 20 },
      { category: "streaming", label: "Streaming", monthly: 15.49 },
    ]);
  });
});

describe("daily series", () => {
  it("buckets upcoming charges by day, split into subscriptions and bills", () => {
    const d = dash({
      upcoming: [
        { merchant: "Notion", merchantKey: "notion", amount: 10, currency: "USD", date: TODAY, source: "subscription", daysAway: 0 },
        { merchant: "PG&E", merchantKey: "pge", amount: 142.18, currency: "USD", date: "2026-11-11", source: "bill", daysAway: 2 },
      ],
    });
    const s = dailySeries(d, TODAY, 60);
    expect(s).toHaveLength(60);
    expect(s[0]).toMatchObject({ date: TODAY, subs: 10, bills: 0 });
    expect(s[2]).toMatchObject({ date: "2026-11-11", subs: 0, bills: 142.18 });
    expect(s[2].items).toEqual([{ merchant: "PG&E", amount: 142.18 }]);
  });
});

describe("subscription subtitle", () => {
  it("describes what we know instead of an invented plan name", () => {
    expect(subscriptionSubtitle(sub({}), TODAY)).toBe("Billed monthly, last charged Oct 14");
    expect(subscriptionSubtitle(sub({ status: "trial", amount: 9.99 }), TODAY)).toBe("Trial converts to $9.99 a month");
    expect(subscriptionSubtitle(sub({ cadence: null, lastChargeDate: null }), TODAY)).toBe("Found in 3 emails");
  });
});
