import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import SubscriptionForm from "../components/SubscriptionForm";
import { toEditBody, type FormValues } from "../lib/subscription-edit";

const initial: FormValues = { merchant: "Nintendo", amount: "3.99", cadence: "monthly", nextChargeDate: "2026-11-16" };

describe("toEditBody", () => {
  it("sends only the fields that changed when editing", () => {
    expect(toEditBody({ ...initial, amount: "7.99" }, { mode: "edit", merchantKey: "nintendo", initial })).toEqual({
      merchantKey: "nintendo", merchant: null, amount: 7.99, cadence: null, nextChargeDate: null, manual: false,
    });
  });
  it("sends every field for a new manual payment and trims the name", () => {
    expect(toEditBody({ merchant: "  City Gym ", amount: "40", cadence: "monthly", nextChargeDate: "2026-11-25" }, { mode: "add" })).toEqual({
      merchant: "City Gym", amount: 40, cadence: "monthly", nextChargeDate: "2026-11-25", manual: true,
    });
  });
  it("turns empty inputs into null and keeps an unparseable amount for the server to reject", () => {
    const body = toEditBody({ merchant: "Gym", amount: "", cadence: "", nextChargeDate: "" }, { mode: "add" });
    expect(body).toMatchObject({ amount: null, cadence: null, nextChargeDate: null });
    expect(toEditBody({ merchant: "Gym", amount: "abc", cadence: "", nextChargeDate: "" }, { mode: "add" }).amount).toBe("abc");
  });
});

describe("SubscriptionForm", () => {
  it("renders labeled fields and the right actions", () => {
    const edit = renderToStaticMarkup(<SubscriptionForm mode="edit" merchantKey="nintendo" initial={initial} canUndo onClose={() => {}} />);
    for (const label of ["Name", "Amount", "Billing cycle", "Next charge date"]) expect(edit).toContain(label);
    expect(edit).toContain("Save");
    expect(edit).toContain("Undo my changes");
    const add = renderToStaticMarkup(<SubscriptionForm mode="add" initial={{ merchant: "", amount: "", cadence: "monthly", nextChargeDate: "" }} onClose={() => {}} />);
    expect(add).toContain("Add a recurring payment");
    expect(add).not.toContain("Undo my changes");
  });
});
