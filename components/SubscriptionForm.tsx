"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toEditBody, type FormValues } from "@/lib/subscription-edit";
import { Button, Field } from "./ui";

const CYCLES = [
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["quarterly", "Every 3 months"],
  ["yearly", "Yearly"],
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
  onClose,
}: {
  mode: "add" | "edit";
  merchantKey?: string;
  initial: FormValues;
  manual?: boolean;
  canUndo?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState<FormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof FormValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  async function post(url: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save");
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    post(
      "/api/subscriptions/edit",
      mode === "add" ? toEditBody(v, { mode: "add" }) : toEditBody(v, { mode: "edit", merchantKey: merchantKey!, initial, manual }),
    );

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) save();
      }}
    >
      <div className="panel-top">
        <h2 id="form-h">{mode === "add" ? "Add a recurring payment" : `Edit ${initial.merchant}`}</h2>
      </div>
      <p className="fine">
        {mode === "add"
          ? "For payments with no email, like rent or a gym. It shows up with your other subscriptions."
          : "Your changes win over what the emails say and stay after the next sync. Leave a field as it is to keep following the emails."}
      </p>
      <Field id="sf-name" label="Name" value={v.merchant} onChange={set("merchant")} maxLength={80} required={mode === "add"} />
      <Field id="sf-amount" label="Amount" inputMode="decimal" value={v.amount} onChange={set("amount")} placeholder="12.99" />
      <div className="field">
        <label htmlFor="sf-cycle">Billing cycle</label>
        <select id="sf-cycle" className="pill-input" value={v.cadence} onChange={set("cadence")}>
          <option value="">Not sure</option>
          {CYCLES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Field id="sf-date" label="Next charge date" type="date" value={v.nextChargeDate} onChange={set("nextChargeDate")} />
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
      {mode === "edit" && canUndo && merchantKey && (
        <button type="button" className="linkish quiet" style={{ alignSelf: "flex-start", fontSize: 14 }} disabled={busy} onClick={() => post("/api/subscriptions/edit/delete", { merchantKey })}>
          {manual ? "Remove this payment" : "Undo my changes"}
        </button>
      )}
    </form>
  );
}
