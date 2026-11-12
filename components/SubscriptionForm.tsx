"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toEditBody, type FormValues } from "@/lib/subscription-edit";
import type { Category } from "@/lib/categories";
import { addThenCategorize } from "@/lib/save-payment";
import CategorySelect from "./CategorySelect";
import { Button, Field, MerchantMark } from "./ui";

const CYCLES = [
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["quarterly", "Every 3 months"],
  ["semiannual", "Every 6 months"],
  ["yearly", "Every year"],
] as const;

/**
 * Edit a subscription the email reader got wrong, or add a recurring payment by hand.
 * Rendered inside a dialog by the Recurring page.
 */
export default function SubscriptionForm({
  mode,
  merchantKey,
  initial,
  manual = false,
  canUndo = false,
  category,
  onClose,
}: {
  mode: "add" | "edit";
  merchantKey?: string;
  initial: FormValues;
  manual?: boolean;
  canUndo?: boolean;
  category?: Category;
  onClose: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState<FormValues>(initial);
  const [cat, setCat] = useState<Category | "">(mode === "add" ? "" : (category ?? "other"));
  // Set once the payment is saved, so a failed category save is retried alone and never adds the payment again.
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof FormValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  const raw = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  async function send(url: string, body: unknown) {
    const res = await raw(url, body);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save");
    return res;
  }

  async function post(url: string, body: unknown, after?: (res: Response) => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      const res = await send(url, body);
      if (after) await after(res);
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function saveAdd() {
    setBusy(true);
    setError("");
    const r = await addThenCategorize(raw, toEditBody(v, { mode: "add" }), cat, addedKey ?? undefined);
    setBusy(false);
    if (r.ok) {
      onClose();
      router.refresh();
    } else if (r.stage === "payment") {
      setError(r.error);
    } else {
      setAddedKey(r.merchantKey);
      router.refresh();
      setError("Your payment was added, but its category did not save. Press Save category to try again, or close this and change it later.");
    }
  }

  const save = () =>
    mode === "add"
      ? saveAdd()
      : post("/api/subscriptions/edit", toEditBody(v, { mode: "edit", merchantKey: merchantKey!, initial, manual }), async () => {
          // Edits post a category only when it changed.
          if (cat && cat !== (category ?? "other")) await send("/api/categories", { merchantKey: merchantKey!, category: cat });
        });

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) save();
      }}
    >
      <div className="panel-top">
        <div className="form-title">
          {mode === "edit" && category && <MerchantMark merchant={initial.merchant} category={category} size={52} />}
          <div>
            <h2 id="form-h">{mode === "add" ? "Add a recurring payment" : `Edit ${initial.merchant}`}</h2>
            <p className="form-sub">
              {mode === "add" ? "For payments with no email, like rent or a gym. It shows up with your other subscriptions." : "Fix anything Phylax read wrong from your emails."}
            </p>
          </div>
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <Field id="sf-name" label="Name" value={v.merchant} onChange={set("merchant")} maxLength={80} required={mode === "add"} />
      <div className="form-pair">
        <div className="field">
          <label htmlFor="sf-amount">Amount</label>
          <span className="money-input">
            <span aria-hidden="true">$</span>
            <input id="sf-amount" inputMode="decimal" value={v.amount} onChange={set("amount")} placeholder="12.99" />
          </span>
        </div>
        <div className="field">
          <label htmlFor="sf-cycle">Billed</label>
          <select id="sf-cycle" className="pill-input" value={v.cadence} onChange={set("cadence")}>
            <option value="">Not sure</option>
            {CYCLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-pair">
        <Field id="sf-date" label="Next charge" type="date" value={v.nextChargeDate} onChange={set("nextChargeDate")} />
        <div className="field">
          <label htmlFor="sf-category">Category</label>
          <CategorySelect id="sf-category" label="Category" value={cat} onChange={setCat} emptyLabel={mode === "add" ? "Pick for me" : undefined} disabled={addedKey !== null} />
        </div>
      </div>
      {mode === "edit" && <p className="fine">Your changes stay after the next sync. Leave a field as it is to keep following the emails.</p>}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button type="submit" disabled={busy} className="btn-block">
          {busy ? "Saving" : mode === "add" ? (addedKey ? "Save category" : "Add payment") : "Save changes"}
        </Button>
        {mode === "edit" && canUndo && merchantKey && (
          <button type="button" className="linkish" disabled={busy} onClick={() => post("/api/subscriptions/edit/delete", { merchantKey })}>
            {manual ? "Remove this payment" : "Reset to what the emails say"}
          </button>
        )}
      </div>
    </form>
  );
}
