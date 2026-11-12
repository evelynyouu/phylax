import { describe, expect, it } from "vitest";
import { deadlineGroup, deadlineRows } from "../lib/views";
import type { Dashboard, DueItem, Subscription } from "../lib/types";

const TODAY = "2026-11-09";
const sub = (over: Partial<Subscription>): Subscription => ({
  merchantKey: "peacock",
  merchant: "Peacock",
  status: "active",
  amount: 7.99,
  currency: "USD",
  cadence: "monthly",
  lastChargeDate: "2026-10-10",
  nextChargeDate: "2026-11-10",
  priceChange: null,
  cancelUrl: "https://www.peacocktv.com/cancel",
  cancelUrlTrusted: true,
  evidenceEmailIds: ["a"],
  annualCost: 95.88,
  manualCancel: false,
  edited: false,
  manual: false,
  ...over,
});
const due = (over: Partial<DueItem>): DueItem => ({
  key: "peacock|renewal_notice|2026-11-10",
  merchant: "Peacock",
  merchantKey: "peacock",
  label: "Auto-renews",
  amount: 7.99,
  currency: "USD",
  date: "2026-11-10",
  daysAway: 1,
  kind: "renewal_notice",
  cancelUrl: "https://www.peacocktv.com/cancel",
  cancelUrlTrusted: true,
  paid: false,
  reminder: false,
  ...over,
});
const dash = (over: Partial<Dashboard>): Dashboard => ({
  generatedAt: "", subscriptions: [], upcoming: [], due: [], bills: [], receipts: [], totals: { monthly: 0, yearly: 0, count: 0 }, ...over,
});

describe("deadline rows (Bills and deadlines)", () => {
  it("describes each kind the way the final design does", () => {
    const d = dash({
      subscriptions: [
        sub({}),
        sub({ merchantKey: "dropbox", merchant: "Dropbox", cadence: "yearly", amount: 119.88 }),
        sub({ merchantKey: "hulu", merchant: "Hulu", status: "trial", amount: 9.99 }),
      ],
      due: [
        due({}),
        due({ key: "dropbox|renewal_notice|2026-11-28", merchantKey: "dropbox", merchant: "Dropbox", date: "2026-11-28", daysAway: 19, amount: 119.88 }),
        due({ key: "hulu|trial_ending|2026-11-12", merchantKey: "hulu", merchant: "Hulu", kind: "trial_ending", date: "2026-11-12", daysAway: 3, amount: 9.99 }),
        due({ key: "pge|2026-11-20", merchantKey: "pge", merchant: "PG&E", kind: "payment_due", date: "2026-11-20", daysAway: 11, amount: 142.18, cancelUrl: null }),
        due({ key: "pge|2026-11-01", merchantKey: "pge", merchant: "PG&E", kind: "payment_due", date: "2026-11-01", daysAway: -8, amount: 140, cancelUrl: null, paid: true }),
      ],
    });
    const rows = deadlineRows(d, TODAY);
    expect(rows.map((r) => [r.merchant, r.what])).toEqual([
      ["Peacock", "Renews monthly, tomorrow"],
      ["Hulu", "Free trial ends, then $9.99 a month, in 3 days"],
      ["PG&E", "Payment due, in 11 days"],
      ["Dropbox", "Renews yearly, in 19 days"],
    ]);
  });

  it("adds upcoming price rises as their own kind, and skips past ones", () => {
    const d = dash({
      subscriptions: [
        sub({ merchantKey: "duolingo", merchant: "Duolingo", priceChange: { from: 12.99, to: 14.99, effective: "2026-12-01" }, cancelUrl: "https://www.duolingo.com/settings" }),
        sub({ merchantKey: "spotify", merchant: "Spotify", priceChange: { from: 11.99, to: 12.99, effective: "2026-10-03" } }),
      ],
    });
    expect(deadlineRows(d, TODAY)).toEqual([
      expect.objectContaining({ kind: "price_change", key: "duolingo|price|2026-12-01", merchant: "Duolingo", amount: 14.99, daysAway: 22, what: "Price rises from $12.99, in 22 days", cancelUrl: "https://www.duolingo.com/settings" }),
    ]);
  });

  it("marks anything within three days as urgent", () => {
    const rows = deadlineRows(dash({ due: [due({}), due({ key: "x|renewal_notice|2026-11-20", merchantKey: "x", date: "2026-11-20", daysAway: 11 })] }), TODAY);
    expect(rows.map((r) => r.urgent)).toEqual([true, false]);
  });

  it("groups by the design's buckets", () => {
    expect([-2, 0, 6, 7, 20, 21].map(deadlineGroup)).toEqual(["Overdue", "This week", "This week", "Next two weeks", "Next two weeks", "Later"]);
  });
});
