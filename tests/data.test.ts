import { beforeEach, describe, expect, it } from "vitest";
import { billKey, chargesForMonth } from "../lib/calendar";
import { categoryFor } from "../lib/categories";
import {
  clearManualCancel,
  manualCancels,
  markPaid,
  paidKeys,
  reminderKeys,
  resetDbForTests,
  setManualCancel,
  setReminder,
  unmarkPaid,
} from "../lib/db";
import { buildDashboard } from "../lib/resolve";
import type { ExtractedRecord, Subscription } from "../lib/types";

const TODAY = "2026-11-09";

function rec(over: Partial<ExtractedRecord> & { emailDate: string }): ExtractedRecord {
  return {
    emailId: `${over.merchantKey ?? "m"}-${over.emailDate}-${over.kind ?? "receipt"}`,
    kind: "receipt",
    relevant: true,
    merchant: "Netflix",
    merchantKey: "netflix",
    amount: 15.49,
    currency: "USD",
    cadence: "monthly",
    dueDate: null,
    renewalDate: null,
    cancelUrl: "https://www.netflix.com/cancelplan",
    cancelUrlTrusted: true,
    confidence: 0.9,
    method: "rules",
    ...over,
  };
}

const netflix = [
  rec({ emailDate: "2026-08-14T15:00:00Z" }),
  rec({ emailDate: "2026-09-14T15:00:00Z" }),
  rec({ emailDate: "2026-10-14T15:00:00Z" }),
];
const netflixRenewal = rec({ emailDate: "2026-11-07T15:00:00Z", kind: "renewal_notice", renewalDate: "2026-11-14" });
const pgeBill = rec({
  emailDate: "2026-11-01T15:00:00Z",
  kind: "payment_due",
  merchant: "PG&E",
  merchantKey: "pge",
  amount: 142.18,
  cadence: null,
  dueDate: "2026-11-20",
  cancelUrl: null,
});

describe("categories", () => {
  it("maps known merchants and falls back to Other", () => {
    expect(categoryFor("netflix")).toBe("streaming");
    expect(categoryFor("openai")).toBe("software");
    expect(categoryFor("dropbox")).toBe("storage");
    expect(categoryFor("amazon")).toBe("shopping");
    expect(categoryFor("chegg")).toBe("learning");
    expect(categoryFor("acmecloud")).toBe("other");
  });
});

describe("manual cancellation", () => {
  it("hides future charges and renewal deadlines after 'I've cancelled it'", () => {
    const d = buildDashboard([...netflix, netflixRenewal, pgeBill], {
      today: TODAY,
      manualCancels: new Map([["netflix", "2026-11-08T10:00:00Z"]]),
    });
    const s = d.subscriptions.find((x) => x.merchantKey === "netflix")!;
    expect(s).toMatchObject({ status: "cancelled", manualCancel: true, nextChargeDate: null });
    expect(d.upcoming.some((u) => u.merchantKey === "netflix")).toBe(false);
    expect(d.due.some((x) => x.merchantKey === "netflix")).toBe(false);
  });

  it("comes back to active when a newer receipt arrives", () => {
    const newer = rec({ emailDate: "2026-11-14T15:00:00Z" });
    const d = buildDashboard([...netflix, newer], {
      today: "2026-11-15",
      manualCancels: new Map([["netflix", "2026-11-08T10:00:00Z"]]),
    });
    expect(d.subscriptions.find((x) => x.merchantKey === "netflix")).toMatchObject({ status: "active", manualCancel: false });
  });

  it("never hides a bill from the same merchant", () => {
    const bill = { ...pgeBill, merchant: "Netflix", merchantKey: "netflix", dueDate: "2026-11-25" };
    const d = buildDashboard([...netflix, bill], { today: TODAY, manualCancels: new Map([["netflix", "2026-11-08T10:00:00Z"]]) });
    expect(d.due.some((x) => x.kind === "payment_due" && x.merchantKey === "netflix")).toBe(true);
    expect(d.bills.some((b) => b.merchantKey === "netflix")).toBe(true);
  });
});

describe("paid bills and reminders", () => {
  it("marks a paid bill and drops it from upcoming charges", () => {
    const key = billKey("pge", "2026-11-20");
    const d = buildDashboard([pgeBill], { today: TODAY, paid: new Set([key]), reminders: new Set([key]) });
    expect(d.upcoming.some((u) => u.merchantKey === "pge")).toBe(false);
    expect(d.due.find((x) => x.key === key)).toMatchObject({ paid: true, reminder: true });
    expect(d.bills.find((b) => b.key === key)).toMatchObject({ paid: true, reminder: true, dueDate: "2026-11-20" });
  });
});

describe("calendar", () => {
  const sub = (over: Partial<Subscription>): Subscription => ({
    merchantKey: "x",
    merchant: "X",
    status: "active",
    amount: 10,
    currency: "USD",
    cadence: "monthly",
    lastChargeDate: null,
    nextChargeDate: "2026-11-14",
    priceChange: null,
    cancelUrl: null,
    cancelUrlTrusted: false,
    evidenceEmailIds: [],
    annualCost: 120,
    manualCancel: false,
    ...over,
  });
  const empty = { subscriptions: [], bills: [], receipts: [] };

  it("projects monthly charges into any future month", () => {
    const e = chargesForMonth({ ...empty, subscriptions: [sub({})] }, 2027, 3, TODAY);
    expect(e.map((x) => x.date)).toEqual(["2027-03-14"]);
    expect(e[0]).toMatchObject({ kind: "subscription", amount: 10, merchantKey: "x" });
  });

  it("does not drift when the anchor is the 31st", () => {
    const s = sub({ nextChargeDate: "2027-01-31" });
    expect(chargesForMonth({ ...empty, subscriptions: [s] }, 2027, 2, TODAY).map((x) => x.date)).toEqual(["2027-02-28"]);
    expect(chargesForMonth({ ...empty, subscriptions: [s] }, 2027, 3, TODAY).map((x) => x.date)).toEqual(["2027-03-31"]);
  });

  it("handles weekly, quarterly and yearly cadences", () => {
    const weekly = sub({ cadence: "weekly", nextChargeDate: "2026-12-02" });
    expect(chargesForMonth({ ...empty, subscriptions: [weekly] }, 2026, 12, TODAY)).toHaveLength(5);
    const yearly = sub({ cadence: "yearly", nextChargeDate: "2026-12-01" });
    expect(chargesForMonth({ ...empty, subscriptions: [yearly] }, 2027, 12, TODAY).map((x) => x.date)).toEqual(["2027-12-01"]);
    expect(chargesForMonth({ ...empty, subscriptions: [yearly] }, 2027, 6, TODAY)).toEqual([]);
    const q = sub({ cadence: "quarterly", nextChargeDate: "2026-11-30" });
    expect(chargesForMonth({ ...empty, subscriptions: [q] }, 2027, 2, TODAY).map((x) => x.date)).toEqual(["2027-02-28"]);
  });

  it("projects only from today on; past days show real receipts instead", () => {
    const s = sub({ nextChargeDate: "2026-11-14" });
    const receipts = [{ merchantKey: "x", merchant: "X", amount: 10, currency: "USD", date: "2026-10-14" }];
    const oct = chargesForMonth({ ...empty, subscriptions: [s], receipts }, 2026, 10, TODAY);
    expect(oct).toEqual([expect.objectContaining({ date: "2026-10-14", kind: "charged" })]);
    const nov = chargesForMonth({ ...empty, subscriptions: [s] }, 2026, 11, TODAY);
    expect(nov.map((x) => x.date)).toEqual(["2026-11-14"]);
  });

  it("skips cancelled subscriptions and includes bills by due date", () => {
    const bills = [{ key: "pge|2026-11-20", merchantKey: "pge", merchant: "PG&E", amount: 142.18, currency: "USD", dueDate: "2026-11-20", paid: false, reminder: false }];
    const e = chargesForMonth({ ...empty, subscriptions: [sub({ status: "cancelled", nextChargeDate: null })], bills }, 2026, 11, TODAY);
    expect(e).toEqual([expect.objectContaining({ date: "2026-11-20", kind: "bill", merchant: "PG&E" })]);
  });
});

describe("db: paid, reminders, manual cancels", () => {
  beforeEach(() => resetDbForTests());

  it("stores and clears each kind of user mark", () => {
    markPaid("pge|2026-11-20");
    setReminder("pge|2026-11-20", true);
    setManualCancel("netflix");
    expect(paidKeys().has("pge|2026-11-20")).toBe(true);
    expect(reminderKeys().has("pge|2026-11-20")).toBe(true);
    expect(manualCancels().get("netflix")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    unmarkPaid("pge|2026-11-20");
    setReminder("pge|2026-11-20", false);
    clearManualCancel("netflix");
    expect(paidKeys().size + reminderKeys().size + manualCancels().size).toBe(0);
  });
});
