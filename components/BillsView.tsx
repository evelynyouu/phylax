"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CancelAction from "./CancelAction";
import CategorySelect from "./CategorySelect";
import { deadlineGroup, type DeadlineRow } from "@/lib/views";
import { Chip } from "./ui";

export type BillRow = DeadlineRow & { amountLabel: string };

export interface PaidRow {
  key: string;
  merchant: string;
  amountLabel: string;
  dueLabel: string;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const KINDS = [
  ["all", "All"],
  ["payment_due", "Bills"],
  ["trial_ending", "Trials"],
  ["renewal_notice", "Renewals"],
  ["price_change", "Price changes"],
] as const;

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save");
}

export default function BillsView({ rows, paid }: { rows: BillRow[]; paid: PaidRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "paid">("upcoming");
  const [kind, setKind] = useState<"all" | BillRow["kind"]>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(key: string, url: string, body: unknown) {
    setBusy(key);
    setError("");
    try {
      await post(url, body);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  const bills30 = rows.filter((r) => r.kind === "payment_due" && r.daysAway >= 0 && r.daysAway < 30).reduce((a, r) => a + (r.amount ?? 0), 0);
  const trialsWeek = rows.filter((r) => r.kind === "trial_ending" && r.daysAway < 7).reduce((a, r) => a + (r.amount ?? 0), 0);
  const renewals = rows.filter((r) => r.kind === "renewal_notice").reduce((a, r) => a + (r.amount ?? 0), 0);
  const shown = rows.filter((r) => kind === "all" || r.kind === kind);
  const groups = (["Overdue", "This week", "Next two weeks", "Later"] as const)
    .map((title) => ({ title, items: shown.filter((r) => deadlineGroup(r.daysAway) === title) }))
    .filter((g) => g.items.length);

  return (
    <>
      <h1 className="display" style={{ fontSize: 44, lineHeight: 1 }}>
        Bills and deadlines
      </h1>
      <p className="intro">
        Bills to pay, free trials about to convert, and yearly renewals you can still stop. Mark a bill paid once you&apos;ve paid it.
      </p>

      <div className="tiles">
        <div className="tile sky">
          <p>Bills due in 30 days</p>
          <p>{usd(bills30)}</p>
        </div>
        <div className="tile mauve">
          <p>Trials converting this week</p>
          <p>{usd(trialsWeek)}</p>
        </div>
        <div className="tile sage">
          <p>Renewals you can still stop</p>
          <p>{usd(renewals)}</p>
        </div>
      </div>

      <div className="tabbar">
        <div role="tablist" aria-label="Status" className="tabs">
          <button type="button" role="tab" id="tab-up" className="tab" aria-selected={tab === "upcoming"} aria-controls="panel-bills" onClick={() => setTab("upcoming")}>
            Upcoming {rows.length}
          </button>
          <button type="button" role="tab" id="tab-paid" className="tab" aria-selected={tab === "paid"} aria-controls="panel-bills" onClick={() => setTab("paid")}>
            Paid {paid.length}
          </button>
        </div>
        {tab === "upcoming" && (
          <div role="group" aria-label="Type" className="kind-chips">
            {KINDS.map(([k, label]) => (
              <Chip key={k} pressed={kind === k} onClick={() => setKind(k)}>
                {label}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="notice-bar warn">
          {error}
        </p>
      )}

      <div role="tabpanel" id="panel-bills" aria-labelledby={tab === "upcoming" ? "tab-up" : "tab-paid"}>
        {tab === "upcoming" &&
          groups.map((g) => (
            <section key={g.title} className="bill-group" aria-label={g.title}>
              <h2>{g.title}</h2>
              <ul className="list-plain bill-items">
                {g.items.map((r) => (
                  <li key={r.key} className="bill-item">
                    <div className={`datebox ${r.urgent ? "urgent" : r.kind === "payment_due" ? "bill" : "plain"}`} aria-hidden="true">
                      <span>{MON[Number(r.date.slice(5, 7)) - 1]}</span>
                      <span>{Number(r.date.slice(8, 10))}</span>
                    </div>
                    <div className="bill-main">
                      <p className="name">{r.merchant}</p>
                      <CategorySelect
                        id={`cat-${r.key}`}
                        label={`Category for ${r.merchant}`}
                        className="pill-input cat-select"
                        value={r.category}
                        disabled={busy === `cat-${r.key}`}
                        onChange={(c) => act(`cat-${r.key}`, "/api/categories", { merchantKey: r.merchantKey, category: c })}
                      />
                      <p className={`what${r.urgent ? " urgent" : ""}`}>{r.what}</p>
                      {r.kind === "payment_due" && (
                        <label className="remind">
                          <input
                            type="checkbox"
                            checked={r.reminder}
                            disabled={busy === r.key}
                            onChange={(e) => act(r.key, "/api/bills/reminder", { key: r.key, on: e.target.checked })}
                          />
                          Remind me 2 days before<span className="sr-only"> on the dashboard</span>
                        </label>
                      )}
                    </div>
                    <p className="bill-amt">{r.amountLabel}</p>
                    <div className="bill-acts">
                      {r.kind === "payment_due" ? (
                        <button type="button" className="btn btn-primary btn-row" disabled={busy === r.key} onClick={() => act(r.key, "/api/bills/paid", { key: r.key })}>
                          Mark paid<span className="sr-only"> for {r.merchant}</span>
                        </button>
                      ) : r.cancelUrl ? (
                        <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start" }}>
                          <CancelAction url={r.cancelUrl} trusted={r.cancelUrlTrusted} merchant={r.merchant} hostInLabel />
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: 14 }}>
                          No cancel link in your emails
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

        {tab === "upcoming" && groups.length === 0 && (
          <div className="empty-card">
            <p className="display">All clear</p>
            <p>Nothing of this type is due. New bills appear after your next sync.</p>
          </div>
        )}

        {tab === "paid" &&
          (paid.length ? (
            <ul className="list-plain paid-list">
              {paid.map((p) => (
                <li key={p.key}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sage-ink)" strokeWidth="2.2" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12l3 3 5-6" />
                  </svg>
                  <span className="what">
                    <span>{p.merchant}</span>
                    <span>Marked paid, was due {p.dueLabel}</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{p.amountLabel}</span>
                  <button type="button" className="linkish" disabled={busy === p.key} onClick={() => act(p.key, "/api/bills/paid", { key: p.key, undo: true })}>
                    Undo<span className="sr-only"> paid for {p.merchant}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-card">
              <p className="display">Nothing marked paid yet</p>
              <p>Bills you mark paid show up here.</p>
            </div>
          ))}
      </div>
    </>
  );
}
