import { describe, expect, it } from "vitest";
import { buildDashboard } from "../lib/resolve";
import type { SubscriptionEdit } from "../lib/store/types";
import type { ExtractedRecord } from "../lib/types";

const TODAY = "2026-11-11";

function receipt(emailDate: string, amount = 15.49): ExtractedRecord {
  return {
    emailId: `nf-${emailDate}`, emailDate: `${emailDate}T15:00:00Z`, kind: "receipt", relevant: true,
    merchant: "Netflix", merchantKey: "netflix", amount, currency: "USD", cadence: "monthly",
    dueDate: null, renewalDate: null, cancelUrl: null, cancelUrlTrusted: false, confidence: 0.9, method: "rules",
  };
}
const netflix = [receipt("2026-08-14"), receipt("2026-09-14"), receipt("2026-10-14")];

function edit(over: Partial<SubscriptionEdit> & { merchantKey: string }): SubscriptionEdit {
  return { merchant: null, amount: null, currency: null, cadence: null, nextChargeDate: null, manual: false, updatedAt: "2026-11-11T00:00:00Z", ...over };
}

describe("subscription edits", () => {
  it("overrides only the edited fields of an email subscription", () => {
    const d = buildDashboard(netflix, { today: TODAY, edits: [edit({ merchantKey: "netflix", amount: 17.99 })] });
    const s = d.subscriptions.find((x) => x.merchantKey === "netflix")!;
    expect(s).toMatchObject({ amount: 17.99, cadence: "monthly", merchant: "Netflix", nextChargeDate: "2026-11-14", edited: true, manual: false });
    expect(s.annualCost).toBeCloseTo(17.99 * 12);
    expect(d.totals.monthly).toBeCloseTo(17.99);
  });

  it("replaces the next charge date and the upcoming list", () => {
    const d = buildDashboard(netflix, { today: TODAY, edits: [edit({ merchantKey: "netflix", nextChargeDate: "2026-11-20" })] });
    expect(d.subscriptions[0].nextChargeDate).toBe("2026-11-20");
    expect(d.upcoming.filter((u) => u.merchantKey === "netflix").map((u) => u.date)[0]).toBe("2026-11-20");
  });

  it("adds a manual recurring payment that has no email", () => {
    const d = buildDashboard([], { today: TODAY, edits: [edit({ merchantKey: "gym", merchant: "Gym", amount: 40, currency: "USD", cadence: "monthly", nextChargeDate: "2026-11-25", manual: true })] });
    expect(d.subscriptions).toEqual([expect.objectContaining({ merchant: "Gym", amount: 40, status: "active", manual: true, edited: false, nextChargeDate: "2026-11-25" })]);
    expect(d.upcoming.some((u) => u.merchantKey === "gym" && u.date === "2026-11-25")).toBe(true);
    expect(d.totals.monthly).toBeCloseTo(40);
  });

  it("rolls a manual payment's past date forward by its cycle", () => {
    const d = buildDashboard([], { today: TODAY, edits: [edit({ merchantKey: "gym", merchant: "Gym", amount: 40, cadence: "monthly", nextChargeDate: "2026-10-25", manual: true })] });
    expect(d.subscriptions[0].nextChargeDate).toBe("2026-11-25");
  });

  it("does not duplicate when a manual entry matches an email subscription", () => {
    const d = buildDashboard(netflix, { today: TODAY, edits: [edit({ merchantKey: "netflix", merchant: "Netflix", amount: 19.99, manual: true })] });
    expect(d.subscriptions.filter((x) => x.merchantKey === "netflix")).toHaveLength(1);
    expect(d.subscriptions[0]).toMatchObject({ amount: 19.99, edited: true });
  });

  it("keeps a dismissed merchant hidden even with an edit", () => {
    const d = buildDashboard(netflix, { today: TODAY, dismissed: new Set(["netflix", "gym"]), edits: [edit({ merchantKey: "netflix", amount: 1 }), edit({ merchantKey: "gym", merchant: "Gym", amount: 40, cadence: "monthly", manual: true })] });
    expect(d.subscriptions).toEqual([]);
  });

  it("does not list a manual entry with no amount and no date", () => {
    const d = buildDashboard([], { today: TODAY, edits: [edit({ merchantKey: "x", merchant: "X", manual: true })] });
    expect(d.subscriptions).toEqual([]);
  });

  it("ignores a non-manual edit for a merchant with no email subscription", () => {
    const d = buildDashboard([], { today: TODAY, edits: [edit({ merchantKey: "ghost", amount: 5 })] });
    expect(d.subscriptions).toEqual([]);
  });

  it("marks plain email subscriptions as neither edited nor manual", () => {
    const d = buildDashboard(netflix, { today: TODAY });
    expect(d.subscriptions[0]).toMatchObject({ edited: false, manual: false });
  });
});
