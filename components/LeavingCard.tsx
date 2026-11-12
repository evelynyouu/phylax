"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LEAVING_RANGES as RANGES, type DayPoint, type LeavingKind, type LeavingRange as Range, type LeavingSummary } from "@/lib/views";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => `${MON[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const COLOR: Record<LeavingKind, string> = {
  bill: "var(--evergreen)",
  subscription: "var(--sage)",
  renewal: "var(--sage-soft)",
  trial: "var(--mauve)",
};

/** Counts the big total from one range's figure to the next, unless the visitor prefers less motion. */
function useTween(target: number) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      const raf = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(raf);
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 600);
      const v = start + (target - start) * (1 - Math.pow(1 - t, 3));
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

/** "Leaving your account": split by kind, per-day chart, three small figures. Port of Dashboard.dc.html. */
export default function LeavingCard({ summaries, series, weekTotal }: { summaries: Record<Range, LeavingSummary>; series: DayPoint[]; weekTotal: number }) {
  const [range, setRange] = useState<Range>(30);
  const [hover, setHover] = useState<string | null>(null);
  const s = summaries[range];
  const shownTotal = useTween(s.total);
  const days = series.slice(0, range);
  // Square-root heights so one large bill does not flatten every subscription bar.
  const max = Math.max(1, ...days.map((d) => Math.sqrt(d.subs + d.bills)));
  const hovered = days.find((d) => d.date === hover && d.items.length);
  const shownDay = hovered ?? (s.biggest ? days.find((d) => d.date === s.biggest!.date) : undefined);
  const readItems = shownDay?.items.length ? shownDay.items.map((i) => `${i.merchant} ${usd(i.amount)}`).join(", ") : "nothing due";
  const billsPct = Math.round(s.groups[0].pct);
  const minis = [
    { label: "Cancel links found", value: String(s.cancelLinks.found), of: `of ${s.cancelLinks.of} subscription${s.cancelLinks.of === 1 ? "" : "s"}`, pct: s.cancelLinks.of ? (s.cancelLinks.found / s.cancelLinks.of) * 100 : 0, color: "var(--evergreen)" },
    { label: "Optional spending", value: usd(s.optional), of: `of ${usd(s.total)}`, pct: s.total ? (s.optional / s.total) * 100 : 0, color: "var(--sage)" },
    s.biggest
      ? { label: "Biggest day", value: short(s.biggest.date), of: usd(s.biggest.amount), pct: s.total ? (s.biggest.amount / s.total) * 100 : 0, color: "var(--mauve)" }
      : { label: "Biggest day", value: "None", of: "", pct: 0, color: "var(--mauve)" },
  ];

  return (
    <section aria-labelledby="out-h" className="out-card">
      <div className="out-inner">
        <div className="out-head">
          <div>
            <h2 id="out-h">Leaving your account</h2>
            <p className="out-range">Next {range} days, from today</p>
          </div>
          <div role="group" aria-label="Range" className="range-seg" style={{ ["--i" as string]: RANGES.indexOf(range) }}>
            <span aria-hidden="true" className="range-thumb" />
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={r === range}
                onClick={() => {
                  setRange(r);
                  setHover(null);
                }}
              >
                {r} days
              </button>
            ))}
          </div>
        </div>

        <div className="out-body">
          <div className="out-split">
            <div className="out-total-row">
              <p aria-live="polite">
                <span className="out-total">{usd(shownTotal)}</span>
                <span className="out-count">
                  across {s.count} payment{s.count === 1 ? "" : "s"}
                </span>
              </p>
              <span className="out-bills">{billsPct}% bills</span>
            </div>
            <div role="img" aria-label={s.groups.map((g) => `${g.label} ${usd(g.amount)}`).join(", ")} className="split-bar">
              {s.groups.map((g) => (
                <span key={g.kind} style={{ width: `${g.pct}%`, background: COLOR[g.kind] }} />
              ))}
            </div>
            <ul className="list-plain split-list">
              {s.groups.map((g) => (
                <li key={g.kind}>
                  <span aria-hidden="true" className="sq" style={{ background: COLOR[g.kind] }} />
                  <span className="nm">
                    {g.label} <span>{g.count || ""}</span>
                  </span>
                  <span className="amt">{usd(g.amount)}</span>
                  <span className="pc">{Math.round(g.pct)}%</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="out-daily">
            <div className="daily-head">
              <span>Per day</span>
              <span>
                Avg <strong>{usd(s.avgPerDay)}</strong> / day
              </span>
            </div>
            <div
              className="day-bars"
              role="img"
              aria-label={s.biggest ? `Charges per day for the next ${range} days. Biggest day ${short(s.biggest.date)} at ${usd(s.biggest.amount)}.` : `No charges in the next ${range} days.`}
              style={{ gap: range > 40 ? 2 : range > 10 ? 3 : 8 }}
              onMouseLeave={() => setHover(null)}
            >
              {days.map((d) => {
                const t = d.subs + d.bills;
                const on = hover === d.date && t > 0;
                return (
                  <span key={d.date} className="day-bar" onMouseEnter={() => setHover(d.date)}>
                    <span
                      className={t ? (on ? "on" : t > 1000 ? "big" : "") : "empty"}
                      style={{ height: `${t ? Math.max(8, (Math.sqrt(t) / max) * 100) : 3}%` }}
                    />
                  </span>
                );
              })}
            </div>
            <p aria-live="polite" className="readout">
              {shownDay && (
                <>
                  <strong>
                    {short(shownDay.date)}
                    {hovered ? ":" : ", the biggest day:"}
                  </strong>{" "}
                  {readItems}
                </>
              )}
            </p>
            <div className="minis">
              {minis.map((m) => (
                <div key={m.label}>
                  <p className="lbl">{m.label}</p>
                  <p className="val">
                    <strong>{m.value}</strong> <span>{m.of}</span>
                  </p>
                  <div className="mini-track">
                    <span style={{ width: `${m.pct.toFixed(1)}%`, background: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="out-foot">
        <span>{usd(weekTotal)} due in the next 7 days</span>
        <Link href="/app/calendar" className="btn-light">
          Open calendar
        </Link>
      </div>
    </section>
  );
}
