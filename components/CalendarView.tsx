"use client";

import { useState } from "react";
import { chargesForMonth, monthBounds, type CalendarEntry } from "@/lib/calendar";
import type { BillItem, PastCharge, Subscription } from "@/lib/types";

const MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

type Kind = "s" | "r" | "t" | "b" | "c";
const KIND: Record<Kind, { dot: string; label: string; group: "subs" | "trials" | "bills" }> = {
  s: { dot: "var(--sage)", label: "Subscription charge", group: "subs" },
  r: { dot: "var(--evergreen)", label: "Yearly renewal", group: "subs" },
  t: { dot: "var(--mauve)", label: "Free trial ends, then charges", group: "trials" },
  b: { dot: "var(--bill-dot)", label: "Bill due", group: "bills" },
  c: { dot: "var(--sage)", label: "Charged, from a receipt", group: "subs" },
};

function kindOf(e: CalendarEntry, subs: Map<string, Subscription>): Kind {
  if (e.kind === "bill") return "b";
  if (e.kind === "charged") return "c";
  const s = subs.get(e.merchantKey);
  if (s?.status === "trial" && s.nextChargeDate === e.date) return "t";
  if (s?.cadence === "yearly") return "r";
  return "s";
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function CalendarView({
  subscriptions,
  bills,
  receipts,
  today,
}: {
  subscriptions: Subscription[];
  bills: BillItem[];
  receipts: PastCharge[];
  today: string;
}) {
  const [ym, setYm] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [show, setShow] = useState({ subs: true, trials: true, bills: true });
  const [sel, setSel] = useState<string>(today);

  const subs = new Map(subscriptions.map((s) => [s.merchantKey, s]));
  const all = chargesForMonth({ subscriptions, bills, receipts }, ym.y, ym.m, today).map((e) => ({ ...e, k: kindOf(e, subs) }));
  const items = all.filter((e) => show[KIND[e.k].group]);
  const { start, end } = monthBounds(ym.y, ym.m);
  const daysIn = Number(end.slice(8, 10));
  const firstDow = new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay();
  const byDay = (d: string) => items.filter((e) => e.date === d);
  const totalOf = (es: typeof items) => es.reduce((a, e) => a + (e.amount ?? 0), 0);

  const selected = sel >= start && sel <= end ? sel : null;
  const dayItems = selected ? byDay(selected) : [];
  const heaviest = Array.from({ length: daysIn }, (_, i) => `${ym.y}-${pad(ym.m)}-${pad(i + 1)}`)
    .map((d) => ({ d, t: totalOf(byDay(d)) }))
    .sort((a, b) => b.t - a.t)[0];
  const monthName = `${MN[ym.m - 1]} ${ym.y}`;
  const sums = { subs: 0, trials: 0, bills: 0 };
  for (const e of items) sums[KIND[e.k].group] += e.amount ?? 0;

  function go(delta: number) {
    const idx = ym.y * 12 + ym.m - 1 + delta;
    setYm({ y: Math.floor(idx / 12), m: (idx % 12) + 1 });
  }

  const selDate = selected ? new Date(`${selected}T00:00:00Z`) : null;

  return (
    <>
      <div className="page-head head-end">
        <div>
          <h1>Calendar</h1>
          <p className="head-sub">
            {items.length} charge{items.length === 1 ? "" : "s"} and due dates in {MN[ym.m - 1]}
            {heaviest && heaviest.t > 0 ? `. The heaviest day is ${MN[ym.m - 1].slice(0, 3)} ${Number(heaviest.d.slice(8))}.` : "."}
          </p>
        </div>
        <div className="month-nav">
          <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => go(-1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <p aria-live="polite" className="month-name">
            {monthName}
          </p>
          <button type="button" className="icon-btn" aria-label="Next month" onClick={() => go(1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div role="group" aria-label="Show" className="toggles">
        {(
          [
            ["subs", "Subscriptions", "var(--sage)"],
            ["trials", "Trials", "var(--mauve)"],
            ["bills", "Bills", "var(--bill-dot)"],
          ] as const
        ).map(([k, label, dot]) => (
          <button key={k} type="button" className="toggle" aria-pressed={show[k]} onClick={() => setShow({ ...show, [k]: !show[k] })}>
            <span aria-hidden="true" className="dot" style={{ background: dot }} />
            {label}
          </button>
        ))}
      </div>

      <div className="cal-wrap">
        <section aria-label={monthName} className="cal-card">
          <div className="cal-inner">
            <div aria-hidden="true" className="cal-dow">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="cal-grid">
              {Array.from({ length: firstDow }, (_, i) => (
                <span key={`b${i}`} aria-hidden="true" />
              ))}
              {Array.from({ length: daysIn }, (_, i) => {
                const d = `${ym.y}-${pad(ym.m)}-${pad(i + 1)}`;
                const es = byDay(d);
                const t = totalOf(es);
                const cls = ["cell", d === today && "today", d < today && "past", t > 1000 && "heavy"].filter(Boolean).join(" ");
                return (
                  <button
                    key={d}
                    type="button"
                    className={cls}
                    aria-pressed={d === selected}
                    aria-label={`${MN[ym.m - 1]} ${i + 1}${d === today ? ", today" : ""}: ${es.length ? `${es.length} item${es.length === 1 ? "" : "s"}, ${usd(t)}` : "nothing due"}`}
                    onClick={() => setSel(d)}
                  >
                    <span className="n">{i + 1}</span>
                    <span className="dots">
                      {es.map((e, j) => (
                        <span key={j} className="dot" style={{ background: KIND[e.k].dot }} />
                      ))}
                    </span>
                    <span className="t">{t ? usd(t) : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="cal-side" aria-labelledby="day-h">
          <section className="day-card">
            <h2 id="day-h">{selDate ? `${DOW[selDate.getUTCDay()]}, ${MN[selDate.getUTCMonth()].slice(0, 3)} ${selDate.getUTCDate()}` : "Pick a day"}</h2>
            <p className="sub">
              {selected === today ? `Today${dayItems.length ? `, ${usd(totalOf(dayItems))}` : ""}` : dayItems.length ? `${usd(totalOf(dayItems))} in total` : ""}
            </p>
            {dayItems.length > 0 ? (
              <ul className="list-plain day-list">
                {dayItems.map((e, j) => (
                  <li key={j}>
                    <span aria-hidden="true" className="dot" style={{ background: KIND[e.k].dot }} />
                    <span className="what">
                      <span>{e.merchant}</span>
                      <span>
                        {KIND[e.k].label}
                        {e.paid ? ", marked paid" : ""}
                      </span>
                    </span>
                    <span className="amt">{e.amount !== null ? usd(e.amount) : ""}</span>
                  </li>
                ))}
              </ul>
            ) : (
              selected && <p style={{ marginTop: 14, fontSize: 15, color: "var(--moss)" }}>Nothing is charged or due this day.</p>
            )}
          </section>
          <section aria-label="Month totals" className="month-total">
            <p className="lbl">{monthName} total</p>
            <p className="big">{usd(sums.subs + sums.trials + sums.bills)}</p>
            <div className="rows">
              <div>
                <span>Subscriptions</span>
                <span>{usd(sums.subs)}</span>
              </div>
              <div>
                <span>Trials converting</span>
                <span>{usd(sums.trials)}</span>
              </div>
              <div>
                <span>Bills</span>
                <span>{usd(sums.bills)}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
