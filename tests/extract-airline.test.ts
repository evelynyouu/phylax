import { describe, expect, it } from "vitest";
import { detectCadence, extractWithRules, pickAmount } from "../lib/extract/rules";
import { buildDashboard } from "../lib/resolve";
import type { RawEmail } from "../lib/types";

// Synthetic airline eTicket receipt. All names, codes and routes are invented.
const AIRLINE: RawEmail = {
  id: "airline-1",
  from: "Skyway Air <receipts@news.skywayair.example>",
  subject: "eTicket Itinerary and Receipt for Confirmation QZ7K4P",
  date: "2026-10-02T15:00:00Z",
  bodyText: [
    "Thank you for choosing Skyway Air.",
    "Confirmation number: QZ7K4P",
    "Traveler: Jordan Example",
    "Flight 1234 Springfield (SPF) to Lakeview (LKV), Fri, Nov 20, 2026",
    "Flight 1235 Lakeview (LKV) to Springfield (SPF), Sun, Nov 29, 2026",
    "",
    "Fare breakdown",
    "Airfare: 612.00 USD",
    "Taxes and fees: 97.40 USD",
    "Total: 709.40 USD",
    "",
    "Refund policy: you are eligible for a full refund if you cancel a ticket purchased at least a week prior to departure.",
    "Baggage: liability for loss, delay, or damage, or delay in delivery of a customer's checked baggage is limited to $3,800 per ticket.",
    "Hazardous materials: violations can result in five years' imprisonment and penalties of $250,000 or more.",
  ].join("\n"),
  links: [],
};

describe("airline eTicket receipt", () => {
  it("extracts the labeled total written with a trailing currency code and no cadence", () => {
    const rec = extractWithRules(AIRLINE);
    expect(rec.amount).toBe(709.4);
    expect(rec.currency).toBe("USD");
    expect(rec.cadence).toBeNull();
  });

  it("is not shown as a subscription on the dashboard", () => {
    const rec = extractWithRules(AIRLINE);
    const d = buildDashboard([rec], { today: "2026-11-09" });
    expect(d.subscriptions).toHaveLength(0);
  });
});

describe("cadence must be tied to a price", () => {
  it("ignores prose such as 'at least a week'", () => {
    expect(detectCadence("Refunds if you cancel at least a week prior to departure")).toBeNull();
    expect(detectCadence("You signed up a month ago and spent a year of evenings with us")).toBeNull();
  });
  it("accepts a price followed by a unit", () => {
    expect(detectCadence("$4.99 a week")).toBe("weekly");
    expect(detectCadence("Just $9.99/mo")).toBe("monthly");
    expect(detectCadence("Only 12.99 USD per month")).toBe("monthly");
    expect(detectCadence("$15 / mo")).toBe("monthly");
    expect(detectCadence("£79 per year")).toBe("yearly");
  });
  it("keeps the explicit phrases", () => {
    expect(detectCadence("You are billed monthly")).toBe("monthly");
    expect(detectCadence("Your annual plan renews soon")).toBe("yearly");
    expect(detectCadence("Charged every 3 months")).toBe("quarterly");
    expect(detectCadence("Your weekly subscription")).toBe("weekly");
  });
});

describe("amounts with ISO codes and fine print", () => {
  it("reads a number followed by a currency code", () => {
    expect(pickAmount("Total: 709.40 USD")).toEqual({ amount: 709.4, currency: "USD" });
    expect(pickAmount("Total: 1,234.00 EUR")).toEqual({ amount: 1234, currency: "EUR" });
    expect(pickAmount("Amount paid 42.50 GBP")).toEqual({ amount: 42.5, currency: "GBP" });
  });
  it("does not let liability fine print beat a labeled total", () => {
    expect(pickAmount("liability is limited to $3,800 per ticket. Total charged: $709.40")?.amount).toBe(709.4);
    expect(pickAmount("Total charged: $709.40. Liability is limited to $3,800 per ticket.")?.amount).toBe(709.4);
  });
});
