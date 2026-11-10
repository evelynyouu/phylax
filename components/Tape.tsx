import { addDays } from "@/lib/extract/dates";
import { money, shortDate } from "@/lib/format";
import type { UpcomingPayment } from "@/lib/types";

const DAYS = 60;

/** Sixty days of charges as bars. Height uses a square-root scale so one big bill does not flatten everything else. */
export default function Tape({ upcoming, today }: { upcoming: UpcomingPayment[]; today: string }) {
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i));
  const byDay = new Map<string, UpcomingPayment[]>();
  for (const p of upcoming) {
    const list = byDay.get(p.date) ?? [];
    list.push(p);
    byDay.set(p.date, list);
  }

  const cols = days.map((d) => {
    const items = byDay.get(d) ?? [];
    const subs = items.filter((i) => i.source === "subscription").reduce((s, i) => s + (i.amount ?? 0), 0);
    const bills = items.filter((i) => i.source === "bill").reduce((s, i) => s + (i.amount ?? 0), 0);
    return { d, items, subs, bills, total: subs + bills };
  });
  const max = Math.max(1, ...cols.map((c) => Math.sqrt(c.total)));
  const refYear = Number(today.slice(0, 4));
  const busiest = [...cols].sort((a, b) => b.total - a.total)[0];

  const summary =
    busiest && busiest.total > 0
      ? `Charges over the next ${DAYS} days. The largest day is ${shortDate(busiest.d, refYear)} at ${money(busiest.total)}.`
      : `No charges found in the next ${DAYS} days.`;

  return (
    <div className="tape">
      <div className="tape-bars" role="img" aria-label={summary}>
        {cols.map((c) => {
          if (c.total === 0) return <div key={c.d} className="tape-col empty" />;
          const h = (Math.sqrt(c.total) / max) * 100;
          const title = `${shortDate(c.d, refYear)}: ${c.items
            .map((i) => `${i.merchant} ${money(i.amount, i.currency)}`)
            .join(", ")}`;
          return (
            <div key={c.d} className="tape-col" style={{ height: `${Math.max(h, 6)}%` }} title={title}>
              <div className="tape-subs" style={{ flex: c.subs }} />
              <div className="tape-bills" style={{ flex: c.bills }} />
            </div>
          );
        })}
      </div>
      <div className="tape-ticks" aria-hidden="true">
        {days
          .filter((_, i) => i % 7 === 0)
          .map((d, i) => (
            <span key={d} className="tape-tick">
              {i === 0 ? "Today" : shortDate(d, refYear)}
            </span>
          ))}
      </div>
      <div className="tape-legend">
        <span>
          <span className="swatch" style={{ background: "var(--blue)" }} />
          Subscriptions
        </span>
        <span>
          <span className="swatch" style={{ background: "var(--amber)" }} />
          Bills
        </span>
      </div>
    </div>
  );
}
