"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Category } from "@/lib/categories";
import SubscriptionForm from "./SubscriptionForm";
import type { FormValues } from "@/lib/subscription-edit";
import { Chip, MerchantMark } from "./ui";

export interface SubRow {
  merchantKey: string;
  merchant: string;
  category: Category;
  categoryLabel: string;
  status: "active" | "trial" | "cancelled";
  amountLabel: string;
  per: string; // "a month"
  yearly: number | null;
  yearlyLabel: string;
  monthly: number;
  nextDate: string | null; // for sorting
  nextLabel: string;
  rel: string;
  relUrgent: boolean;
  subtitle: string;
  priceTag: string | null;
  cancelUrl: string | null;
  host: string | null;
  trusted: boolean;
  emails: number;
  manualCancel: boolean;
  cancelledNote: string;
  edited: boolean;
  manual: boolean;
  /** The editable values, as the form shows them. */
  form: FormValues;
}

const ORDER: Category[] = ["streaming", "software", "storage", "shopping", "learning", "other"];
const LABELS: Record<Category, string> = {
  streaming: "Streaming",
  software: "Software and AI",
  storage: "Storage",
  shopping: "Shopping",
  learning: "Learning",
  other: "Other",
};
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function RecurringView({ rows }: { rows: SubRow[] }) {
  const router = useRouter();
  const [cat, setCat] = useState<Category | "all">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"next" | "cost" | "name">("next");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const formDialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<{ mode: "add" } | { mode: "edit"; row: SubRow } | null>(null);

  function openForm(f: { mode: "add" } | { mode: "edit"; row: SubRow }) {
    dialog.current?.close();
    setForm(f);
    requestAnimationFrame(() => formDialog.current?.showModal());
  }

  const live = rows.filter((r) => r.status !== "cancelled");
  const cancelled = rows.filter((r) => r.status === "cancelled");
  const savedYear = cancelled.filter((r) => r.manualCancel).reduce((a, r) => a + (r.yearly ?? 0), 0);
  const monthly = live.filter((r) => r.status === "active").reduce((a, r) => a + r.monthly, 0);
  const needle = q.trim().toLowerCase();

  const list = live
    .filter((r) => (cat === "all" || r.category === cat) && (!needle || r.merchant.toLowerCase().includes(needle)))
    .sort((a, b) =>
      sort === "cost"
        ? (b.yearly ?? 0) - (a.yearly ?? 0)
        : sort === "name"
          ? a.merchant.localeCompare(b.merchant)
          : (a.nextDate ?? "9999").localeCompare(b.nextDate ?? "9999")
    );
  const groups = ORDER.map((c) => ({
    c,
    items: list.filter((r) => r.category === c),
    total: list.filter((r) => r.category === c && r.status === "active").reduce((a, r) => a + r.monthly, 0),
  })).filter((g) => g.items.length);
  const presentCats = ORDER.filter((c) => live.some((r) => r.category === c));
  const open = rows.find((r) => r.merchantKey === openKey) ?? null;

  function show(key: string) {
    setOpenKey(key);
    setError("");
    requestAnimationFrame(() => dialog.current?.showModal());
  }

  async function mark(merchantKey: string, undo: boolean) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/cancelled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantKey, undo }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save");
      dialog.current?.close();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function stopTracking(merchantKey: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantKey }),
      });
      if (!res.ok) throw new Error("Could not save");
      dialog.current?.close();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head head-end">
        <div>
          <h1>Recurring</h1>
          <p className="head-sub">
            {live.length} subscription{live.length === 1 ? "" : "s"}, {usd(monthly)} a month before trials convert.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {savedYear > 0 && (
            <p aria-live="polite" className="saved-pill">
              Cancelled here: {usd(savedYear)} a year
            </p>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => openForm({ mode: "add" })}>
            Add a recurring payment
          </button>
        </div>
      </div>

      <div className="filters">
        <div role="group" aria-label="Category" className="chip-group">
          <Chip pressed={cat === "all"} onClick={() => setCat("all")}>
            All {live.length}
          </Chip>
          {presentCats.map((c) => (
            <Chip key={c} pressed={cat === c} onClick={() => setCat(c)}>
              {LABELS[c]} {live.filter((r) => r.category === c).length}
            </Chip>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label htmlFor="sub-q" className="sr-only">
            Search subscriptions
          </label>
          <input id="sub-q" type="search" placeholder="Search" className="pill-input" value={q} onChange={(e) => setQ(e.target.value)} />
          <label htmlFor="sub-sort" className="sr-only">
            Sort by
          </label>
          <select id="sub-sort" className="pill-input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="next">Sort: next charge</option>
            <option value="cost">Sort: yearly cost</option>
            <option value="name">Sort: name</option>
          </select>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.c} className="group" aria-labelledby={`g-${g.c}`}>
          <div className="group-head">
            <h2 id={`g-${g.c}`}>{LABELS[g.c]}</h2>
            <span>{usd(g.total)} a month</span>
          </div>
          <ul className="list-plain sub-list">
            {g.items.map((r) => (
              <li key={r.merchantKey} className="sub-row">
                <MerchantMark merchant={r.merchant} category={r.category} size={42} />
                <div className="sub-main">
                  <p className="name">
                    {r.merchant}
                    {r.status === "trial" && <span className="tag tag-trial">Free trial</span>}
                    {r.priceTag && <span className="tag tag-attention">{r.priceTag}</span>}
                    {r.manual ? <span className="tag tag-neutral">Added by you</span> : r.edited && <span className="tag tag-neutral">Edited</span>}
                  </p>
                  <p className="plan">{r.subtitle}</p>
                </div>
                <div className="sub-next">
                  <p>{r.nextLabel}</p>
                  <p className={r.relUrgent ? "urgent" : undefined}>{r.rel}</p>
                </div>
                <div className="sub-amt">
                  <p>{r.amountLabel}</p>
                  <p>{r.per}</p>
                </div>
                <button type="button" className="btn btn-danger btn-row" onClick={() => show(r.merchantKey)}>
                  {r.status === "trial" ? "Cancel trial" : "Cancel"}
                  <span className="sr-only"> {r.merchant}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {groups.length === 0 && (
        <p style={{ marginTop: 32, color: "var(--moss)" }}>
          {live.length ? "No subscriptions match. " : "No subscriptions found yet. "}
          {live.length > 0 && (
            <button type="button" className="linkish" onClick={() => { setCat("all"); setQ(""); }}>
              Clear filters
            </button>
          )}
        </p>
      )}

      {cancelled.length > 0 && (
        <section className="group" aria-labelledby="g-cancelled" style={{ marginTop: 32 }}>
          <div className="group-head">
            <h2 id="g-cancelled">Cancelled</h2>
          </div>
          <ul className="list-plain sub-list cancelled">
            {cancelled.map((r) => (
              <li key={r.merchantKey} className="sub-row">
                <span aria-hidden="true" className="mark" style={{ width: 42, height: 42, background: "var(--surface)", color: "var(--moss)", fontSize: 17 }}>
                  {r.merchant.charAt(0).toUpperCase()}
                </span>
                <div className="sub-main">
                  <p className="name">{r.merchant}</p>
                  <p className="plan">{r.cancelledNote}</p>
                </div>
                <span style={{ fontWeight: 600, color: "var(--moss)" }}>{r.amountLabel}</span>
                {r.manualCancel && (
                  <button type="button" className="linkish" disabled={busy} onClick={() => mark(r.merchantKey, true)}>
                    Undo<span className="sr-only"> cancelling {r.merchant}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <dialog ref={dialog} className="side-dialog" aria-labelledby="panel-h" onClose={() => setOpenKey(null)}>
        {open && (
          <div className="panel">
            <div className="panel-top">
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <MerchantMark merchant={open.merchant} category={open.category} size={52} />
                <div>
                  <h2 id="panel-h">{open.merchant}</h2>
                  <p className="plan">{open.subtitle}</p>
                </div>
              </div>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => dialog.current?.close()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <dl className="facts">
              <div>
                <dt>Costs</dt>
                <dd>
                  {open.amountLabel} {open.per}
                </dd>
              </div>
              <div>
                <dt>A year</dt>
                <dd>{open.yearlyLabel}</dd>
              </div>
              <div>
                <dt>Next charge</dt>
                <dd>{open.nextLabel}</dd>
              </div>
              <div>
                <dt>Found in</dt>
                <dd>
                  {open.emails} email{open.emails === 1 ? "" : "s"}
                </dd>
              </div>
            </dl>

            {open.cancelUrl && open.host ? (
              <>
                <div className={`link-box ${open.trusted ? "trusted" : "untrusted"}`}>
                  <p>{open.trusted ? `Cancel link from ${open.merchant}'s own email` : `This link is not on ${open.merchant}'s website`}</p>
                  <p>
                    {open.trusted
                      ? "It opens on the same website the email came from."
                      : "It points somewhere other than the domain the email came from. Open it only if you recognize the address, and never enter a card number there."}
                  </p>
                  <p className="host">{open.host}</p>
                </div>
                <a className="btn btn-primary btn-block" href={open.cancelUrl} target="_blank" rel="noopener noreferrer">
                  Open the cancel page
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
                  </svg>
                  <span className="sr-only"> (opens {open.host} in a new tab)</span>
                </a>
              </>
            ) : (
              <div className="link-box none">
                <p>No cancel link in your emails</p>
                <p>Cancel from the company&apos;s account settings, then mark it here.</p>
              </div>
            )}
            <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={() => openForm({ mode: "edit", row: open })}>
              Edit details
            </button>
            <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={() => mark(open.merchantKey, false)}>
              {busy ? "Saving" : "I've cancelled it"}
            </button>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <p className="fine">
              Phylax never cancels for you. Marking it here hides future charges from your totals until a new receipt arrives.
            </p>
            <button type="button" className="linkish quiet" style={{ alignSelf: "flex-start", fontSize: 14 }} disabled={busy} onClick={() => stopTracking(open.merchantKey)}>
              Stop tracking {open.merchant}
            </button>
          </div>
        )}
      </dialog>

      <dialog ref={formDialog} className="side-dialog" aria-labelledby="form-h" onClose={() => setForm(null)}>
        {form && (
          <SubscriptionForm
            key={form.mode === "edit" ? form.row.merchantKey : "add"}
            mode={form.mode}
            merchantKey={form.mode === "edit" ? form.row.merchantKey : undefined}
            initial={form.mode === "edit" ? form.row.form : { merchant: "", amount: "", cadence: "monthly", nextChargeDate: "" }}
            manual={form.mode === "edit" && form.row.manual}
            canUndo={form.mode === "edit" && (form.row.edited || form.row.manual)}
            onClose={() => formDialog.current?.close()}
          />
        )}
      </dialog>
    </>
  );
}
