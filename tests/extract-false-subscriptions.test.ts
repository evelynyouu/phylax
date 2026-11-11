import { describe, expect, it } from "vitest";
import { detectCadence, extractWithRules, pickAmount } from "../lib/extract/rules";
import { buildDashboard } from "../lib/resolve";
import type { ExtractedRecord, RawEmail } from "../lib/types";

// Synthetic emails modeled on real false positives. All senders, names and numbers are invented.
function email(id: string, from: string, subject: string, date: string, bodyText: string): RawEmail {
  return { id, from, subject, date, bodyText, links: [] };
}

// A. Department store marketing with a free-shipping threshold, sent twice with the same number.
const promo = (id: string, date: string) =>
  email(
    id,
    "Maple & Co <offers@email.mapleandco.example>",
    "Statement dresses for summer invites",
    date,
    [
      "New arrivals are here. Shop now.",
      "Free standard shipping every day when you spend $50 or more in beauty.",
      "Gift receipts available at checkout.",
      "You are receiving this email because you signed up. Unsubscribe.",
    ].join("\n")
  );

// B. Membership trial welcome with a free-delivery threshold after the real price.
const TRIAL_WELCOME = email(
  "b-1",
  "ShopMart <help@shopmart.example>",
  "Welcome to your ShopMart+ free trial",
  "2026-03-25T15:00:00Z",
  [
    "Your free trial has started.",
    "Trial expiration: Apr 24, 2026 Selected plan: Monthly Payment starts: Apr 24, 2026 Payment amount: $12.95 + applicable taxes",
    "After the 30 -day trial, your plan will auto-renew for $ 12.95 /month. Cancel anytime.",
    "Members get free delivery from your store on orders $35+.",
  ].join("\n")
);

// C. Annual business membership renewal reminder.
const ANNUAL_MEMBERSHIP = email(
  "c-1",
  "Acme Business <membership@acmebiz.example>",
  "Your Prime Business Membership",
  "2026-08-01T15:00:00Z",
  [
    "Your annual Prime Business membership will renew soon.",
    "As a reminder, your 12-month Prime Business membership is set to automatically renew on August 22, 2026.",
    "Membership fee: $212.38",
  ].join("\n")
);

// D. Season pass sales offer that uses the word renew.
const PASS_OFFER = email(
  "d-1",
  "Bears Athletics <tickets@bearsathletics.example>",
  "Last Call | Final Day to Renew Your 2026-27 Student Combo Pass!",
  "2026-05-01T15:00:00Z",
  "TODAY is the final day to renew your 2026-27 Student Combo Pass. For just $125, secure your seat for every home game. RENEW NOW"
);

// E. Grant eligibility notice.
const GRANT = email(
  "e-1",
  "Student Aid Commission <noreply@studentaid.example>",
  "Grant Renewal Status (Eligible for Grant Renewal A&B)",
  "2026-06-01T15:00:00Z",
  "Your grant renewal status has been updated. You are eligible for renewal of your award. Log in to view your eligibility details."
);

// F. Lease renewal survey.
const LEASE_SURVEY = email(
  "f-1",
  "Oak Street Apartments <office@oakstreetapts.example>",
  "Oak Building Lease Renewal Quick Survey",
  "2026-02-10T15:00:00Z",
  "Please take a moment to answer our quick survey about your lease renewal plans for next year. It takes two minutes."
);

// G. Meal plan options menu.
const MEAL_OPTIONS = email(
  "g-1",
  "Campus Dining <dining@campus.example>",
  "Renew your meal plan and your options",
  "2026-04-15T15:00:00Z",
  [
    "Choose a plan for next year.",
    "Basic plan: INCLUDED in your housing contract",
    "Plus plan: Additional $950 per year ($475 per semester)",
    "Premium plan: Additional $1,400 per year ($700 per semester)",
  ].join("\n")
);

describe("A: marketing with a promo threshold", () => {
  it("is marketing, and the threshold is not an amount", () => {
    const rec = extractWithRules(promo("a-1", "2026-06-01T15:00:00Z"));
    expect(rec.kind).toBe("marketing");
    expect(rec.amount).toBeNull();
    expect(pickAmount("Free standard shipping every day when you spend $50 or more in beauty.")).toBeNull();
  });
  it("two copies do not make a subscription", () => {
    const recs = [promo("a-1", "2026-06-01T15:00:00Z"), promo("a-2", "2026-07-01T15:00:00Z")].map(extractWithRules);
    expect(buildDashboard(recs, { today: "2026-07-05" }).subscriptions).toHaveLength(0);
  });
  it("penalizes common threshold phrasings", () => {
    expect(pickAmount("Free shipping on orders over $49")).toBeNull();
    expect(pickAmount("Free delivery on $35+ orders")).toBeNull();
    expect(pickAmount("Get free shipping on orders of $75+")).toBeNull();
    expect(pickAmount("Minimum order $25")).toBeNull();
  });
});

describe("B: trial welcome", () => {
  it("takes the labeled payment amount, not the delivery threshold", () => {
    const rec = extractWithRules(TRIAL_WELCOME);
    expect(rec.amount).toBe(12.95);
    expect(rec.cadence).toBe("monthly");
    expect(["trial_ending", "renewal_notice"]).toContain(rec.kind);
  });
  it("is not active once the trial passed with no receipt", () => {
    const d = buildDashboard([extractWithRules(TRIAL_WELCOME)], { today: "2026-05-02" });
    expect(d.subscriptions).toHaveLength(0);
    expect(d.upcoming).toHaveLength(0);
    expect(d.totals.yearly).toBe(0);
  });
});

describe("C: annual membership", () => {
  it("is yearly at the stated fee", () => {
    const rec = extractWithRules(ANNUAL_MEMBERSHIP);
    expect(rec.kind).toBe("renewal_notice");
    expect(rec.amount).toBe(212.38);
    expect(rec.cadence).toBe("yearly");
  });
  it("is not active once the renewal passed with no receipt", () => {
    const d = buildDashboard([extractWithRules(ANNUAL_MEMBERSHIP)], { today: "2026-11-11" });
    expect(d.subscriptions).toHaveLength(0);
    expect(d.upcoming).toHaveLength(0);
    expect(d.due).toHaveLength(0);
  });
  it("detects yearly membership phrasings", () => {
    expect(detectCadence("your 12-month Gold membership")).toBe("yearly");
    expect(detectCadence("Your plan renews every year")).toBe("yearly");
    expect(detectCadence("Thanks for your yearly membership")).toBe("yearly");
  });
});

describe("D to G: renewal language that is not an existing plan", () => {
  it("D: a renew-now sales offer is marketing", () => {
    expect(extractWithRules(PASS_OFFER).kind).toBe("marketing");
  });
  it("E: grant renewal eligibility is other", () => {
    expect(extractWithRules(GRANT).kind).toBe("other");
  });
  it("F: lease renewal survey is other", () => {
    expect(extractWithRules(LEASE_SURVEY).kind).toBe("other");
  });
  it("G: a plan options menu is marketing and makes no subscription", () => {
    const rec = extractWithRules(MEAL_OPTIONS);
    expect(rec.kind).toBe("marketing");
    expect(buildDashboard([rec], { today: "2026-04-20" }).subscriptions).toHaveLength(0);
  });
});

function rec(over: Partial<ExtractedRecord>): ExtractedRecord {
  return {
    emailId: "r", emailDate: "2026-10-01T15:00:00Z", kind: "renewal_notice", relevant: true,
    merchant: "Widget", merchantKey: "widget", amount: null, currency: null, cadence: null,
    dueDate: null, renewalDate: null, cancelUrl: null, cancelUrlTrusted: false, confidence: 0.6, method: "rules",
    ...over,
  };
}

describe("R1: no amount and no date", () => {
  it("is not listed", () => {
    expect(buildDashboard([rec({})], { today: "2026-10-05" }).subscriptions).toHaveLength(0);
  });
  it("is listed with an amount or a date", () => {
    expect(buildDashboard([rec({ amount: 5 })], { today: "2026-10-05" }).subscriptions).toHaveLength(1);
    expect(buildDashboard([rec({ renewalDate: "2026-10-20" })], { today: "2026-10-05" }).subscriptions).toHaveLength(1);
  });
});

describe("R2: charge date", () => {
  const receipt = (body: string) =>
    email("r2", "Widget <billing@widget.example>", "Your Widget receipt", "2026-09-05T15:00:00Z", body);
  it("uses an explicit order date", () => {
    const r = extractWithRules(receipt("Order date: Sep 3, 2026\nTotal: $9.99\nBilled monthly."));
    expect(r.chargeDate).toBe("2026-09-03");
    const d = buildDashboard([r], { today: "2026-09-10" });
    expect(d.subscriptions[0].lastChargeDate).toBe("2026-09-03");
  });
  it("falls back to the email date", () => {
    const r = extractWithRules(receipt("Total: $9.99\nBilled monthly."));
    expect(r.chargeDate).toBe("2026-09-05");
  });
  it("older records without chargeDate use the email date", () => {
    const r = rec({ kind: "receipt", amount: 9.99, cadence: "monthly", emailDate: "2026-09-05T15:00:00Z" });
    expect(buildDashboard([r], { today: "2026-09-10" }).subscriptions[0].lastChargeDate).toBe("2026-09-05");
  });
});
