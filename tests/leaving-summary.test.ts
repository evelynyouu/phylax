import { describe, expect, it } from "vitest";
import { leavingSummary } from "../lib/views";
import type { Dashboard, Subscription, UpcomingPayment } from "../lib/types";

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
  evidenceEmailIds: ["a"],
  annualCost: 185.88,
  manualCancel: false,
  edited: false,
  manual: false,
  category: "other",
  categoryChosen: false,
  ...over,
});
const up = (merchantKey: string, date: string, amount: number, source: "subscription" | "bill" = "subscription"): UpcomingPayment => ({
  merchant: merchantKey,
  merchantKey,
  amount,
  currency: "USD",
  date,
  source,
  daysAway: 0,
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

describe("leaving summary (the dashboard's top card)", () => {
  const d = dash({
    subscriptions: [
      sub({ merchantKey: "netflix", cancelUrl: "https://netflix.com/cancel" }),
      sub({ merchantKey: "adobe", cadence: "yearly", cancelUrl: "https://adobe.com/x" }),
      sub({ merchantKey: "hulu", status: "trial" }),
      sub({ merchantKey: "peacock", status: "cancelled", cancelUrl: "https://peacocktv.com" }),
    ],
    upcoming: [
      up("netflix", "2026-11-14", 15.49),
      up("adobe", "2026-12-01", 263.88),
      up("hulu", "2026-11-12", 9.99),
      up("pge", "2026-11-20", 142.18, "bill"),
      up("rent", "2026-12-01", 1950, "bill"),
      up("netflix", "2026-12-14", 15.49), // outside a 30-day window
    ],
  });

  it("splits the window into bills, subscriptions, yearly renewals and trials converting", () => {
    const s = leavingSummary(d, TODAY, 30);
    expect(s.total).toBe(2381.54);
    expect(s.count).toBe(5);
    expect(s.groups.map((g) => [g.kind, g.label, g.amount, g.count])).toEqual([
      ["bill", "Bills", 2092.18, 2],
      ["subscription", "Subscriptions", 15.49, 1],
      ["renewal", "Yearly renewals", 263.88, 1],
      ["trial", "Trials converting", 9.99, 1],
    ]);
    expect(s.groups.map((g) => g.pct)).toEqual([87.85, 0.65, 11.08, 0.42]);
  });

  it("works out the average, the biggest day and what is optional", () => {
    const s = leavingSummary(d, TODAY, 30);
    expect(s.avgPerDay).toBe(79.38);
    expect(s.biggest).toEqual({ date: "2026-12-01", amount: 2213.88 });
    expect(s.optional).toBe(289.36);
  });

  it("counts cancel links over subscriptions still running", () => {
    expect(leavingSummary(d, TODAY, 30).cancelLinks).toEqual({ found: 2, of: 3 });
  });

  it("covers a 7-day window and an empty one", () => {
    const week = leavingSummary(d, TODAY, 7);
    expect(week.total).toBe(25.48);
    expect(week.groups.find((g) => g.kind === "bill")?.amount).toBe(0);
    const none = leavingSummary(dash({}), TODAY, 30);
    expect(none.total).toBe(0);
    expect(none.biggest).toBeNull();
    expect(none.groups.every((g) => g.pct === 0)).toBe(true);
  });
});
