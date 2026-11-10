"use client";

import { useState } from "react";
import type { DayPoint } from "@/lib/views";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => `${MON[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** The "money out" card: range toggle, square-root bar chart, hover readout. Port of Dashboard.dc.html. */
export default function DashboardChart({ series }: { series: DayPoint[] }) {
  const [range, setRange] = useState<30 | 60>(30);
  const [hover, setHover] = useState<string | null>(null);

  const days = series.slice(0, range);
  const total = days.reduce((a, d) => a + d.subs + d.bills, 0);
  const count = days.reduce((a, d) => a + d.items.length, 0);
  const subsTotal = days.reduce((a, d) => a + d.subs, 0);
  // Square-root heights so one large bill does not flatten every subscription bar.
  const max = Math.max(1, ...days.map((d) => Math.sqrt(d.subs + d.bills)));
  const busiest = [...days].sort((a, b) => b.subs + b.bills - (a.subs + a.bills))[0];
  const shown = days.find((d) => d.date === hover) ?? busiest;
  const isBusiest = !hover && shown === busiest;
  const readItems = shown?.items.length ? shown.items.map((i) => `${i.merchant} ${usd(i.amount)}`).join(", ") : "nothing due";
  const ticks: string[] = [];
  for (let k = 0; k < range; k += range === 30 ? 7 : 14) ticks.push(k === 0 ? "Today" : short(days[k].date));

  return (
    <section aria-labelledby="out-h" className="out-card">
      <div className="out-head">
        <div style={{ minWidth: 0 }}>
          <h2 id="out-h" className="out-total">
            {usd(total)}
          </h2>
          <p className="out-sub">
            leaves your account in the next {range} days across {count} payment{count === 1 ? "" : "s"}.
          </p>
        </div>
        <div role="group" aria-label="Range" className="seg-group">
          {([30, 60] as const).map((r) => (
            <button key={r} type="button" className="seg" aria-pressed={r === range} onClick={() => { setRange(r); setHover(null); }}>
              {r} days
            </button>
          ))}
        </div>
      </div>

      <div
        className="bars"
        role="img"
        aria-label={busiest && busiest.subs + busiest.bills > 0 ? `Daily charges for the next ${range} days. Biggest day ${short(busiest.date)} at ${usd(busiest.subs + busiest.bills)}.` : `No charges in the next ${range} days.`}
        onMouseLeave={() => setHover(null)}
      >
        {days.map((d) => {
          const t = d.subs + d.bills;
          return (
            <span
              key={d.date}
              className="bar"
              data-on={hover === d.date && t > 0}
              onMouseEnter={() => setHover(d.date)}
            >
              <span className={`bar-fill${t ? "" : " empty"}`} style={{ height: `${t ? Math.max(6, (Math.sqrt(t) / max) * 100) : 2}%` }}>
                <span className="bar-subs" style={{ flex: d.subs }} />
                <span className="bar-bills" style={{ flex: d.bills }} />
              </span>
            </span>
          );
        })}
      </div>
      <div aria-hidden="true" className="ticks">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="out-foot">
        <p aria-live="polite" className="readout">
          {shown && (
            <>
              <strong>{short(shown.date)}{isBusiest && shown.subs + shown.bills > 0 ? ", the biggest day:" : ":"}</strong> {readItems}
            </>
          )}
        </p>
        <div className="legend">
          <span>
            <i aria-hidden="true" className="bar-subs" />
            Subscriptions {usd(subsTotal)}
          </span>
          <span>
            <i aria-hidden="true" className="bar-bills" />
            Bills {usd(total - subsTotal)}
          </span>
        </div>
      </div>
    </section>
  );
}
