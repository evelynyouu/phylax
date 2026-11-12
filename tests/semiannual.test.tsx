import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import SubscriptionForm from "../components/SubscriptionForm";
import { chargesForMonth } from "../lib/calendar";
import { detectCadence } from "../lib/extract/rules";
import { cadenceLabel } from "../lib/format";
import { advance, buildDashboard } from "../lib/resolve";
import { parseEdit } from "../lib/subscription-edit";
import { PER } from "../lib/views";

describe("billed every 6 months", () => {
  it("is a choice in the edit panel's Billed dropdown, next to Every year", () => {
    const html = renderToStaticMarkup(
      <SubscriptionForm mode="edit" merchantKey="gym" initial={{ merchant: "Gym", amount: "60", cadence: "semiannual", nextChargeDate: "2026-12-01" }} onClose={() => {}} />,
    );
    expect(html).toContain('<option value="semiannual" selected="">Every 6 months</option>');
    expect(html).toContain('<option value="yearly">Every year</option>');
  });

  it("is accepted when saving an edit", () => {
    expect(parseEdit({ merchantKey: "gym", cadence: "semiannual" })).toMatchObject({ ok: true });
  });

  it("moves the next charge six months and costs two payments a year", () => {
    expect(advance("2026-08-31", "semiannual")).toBe("2027-02-28");
    const d = buildDashboard([], {
      edits: [{ merchantKey: "gym", merchant: "Gym", amount: 60, currency: "USD", cadence: "semiannual", nextChargeDate: "2026-12-01", manual: true, updatedAt: "" }],
      today: "2026-11-09",
    });
    expect(d.subscriptions[0]).toMatchObject({ cadence: "semiannual", annualCost: 120 });
  });

  it("shows on the calendar every sixth month", () => {
    const empty = { generatedAt: "", upcoming: [], due: [], bills: [], receipts: [], totals: { monthly: 0, yearly: 0, count: 0 } };
    const s = {
      merchantKey: "gym", merchant: "Gym", status: "active" as const, amount: 60, currency: "USD", cadence: "semiannual" as const,
      lastChargeDate: null, nextChargeDate: "2026-12-01", priceChange: null, cancelUrl: null, cancelUrlTrusted: false,
      evidenceEmailIds: [], annualCost: 120, manualCancel: false, edited: false, manual: true,
    };
    const months = [12, 1, 2, 3, 4, 5, 6].map((m) => chargesForMonth({ ...empty, subscriptions: [s] }, m === 12 ? 2026 : 2027, m, "2026-11-09").length);
    expect(months).toEqual([1, 0, 0, 0, 0, 0, 1]);
  });

  it("reads like the other cycles", () => {
    expect(PER.semiannual).toBe("every 6 months");
    expect(cadenceLabel("semiannual")).toBe("every 6 months");
  });

  it("is recognized in billing email", () => {
    expect(detectCadence("Your plan renews every 6 months")).toBe("semiannual");
    expect(detectCadence("Billed semi-annually")).toBe("semiannual");
    expect(detectCadence("$59.99 per 6 months")).toBe("semiannual");
  });

  it("is allowed by the database", () => {
    const dir = path.resolve(import.meta.dirname, "../supabase/migrations");
    const sql = fs.readdirSync(dir).sort().map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
    expect(sql).toMatch(/cadence in \('weekly', 'monthly', 'quarterly', 'semiannual', 'yearly'\)/);
  });
});
