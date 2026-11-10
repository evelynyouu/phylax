import { addDays, addMonths, daysBetween } from "./extract/dates";
import type { BillItem, Cadence, PastCharge, Subscription } from "./types";

export function billKey(merchantKey: string, dueDate: string): string {
  return `${merchantKey}|${dueDate}`;
}

export interface CalendarEntry {
  date: string;
  merchant: string;
  merchantKey: string;
  amount: number | null;
  currency: string;
  /** subscription: expected from cadence; bill: a due date; charged: a receipt that already happened */
  kind: "subscription" | "bill" | "charged";
  paid?: boolean;
}

const MONTHS_PER: Record<Exclude<Cadence, "weekly">, number> = { monthly: 1, quarterly: 3, yearly: 12 };

const pad = (n: number) => String(n).padStart(2, "0");

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${pad(month)}-01`;
  const end = addDays(addMonths(start, 1), -1);
  return { start, end };
}

/**
 * Expected charge dates of one subscription inside [start, end]. Each occurrence is computed from
 * the anchor (the next charge date), never from the previous one, so the 31st does not drift to the 28th.
 */
function occurrences(anchor: string, cadence: Cadence, start: string, end: string): string[] {
  const out: string[] = [];
  if (cadence === "weekly") {
    const offset = daysBetween(anchor, start);
    let k = Math.max(0, Math.ceil(offset / 7));
    for (let d = addDays(anchor, 7 * k); d <= end; d = addDays(anchor, 7 * ++k)) if (d >= start) out.push(d);
    return out;
  }
  const n = MONTHS_PER[cadence];
  const monthIndex = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
  const diff = monthIndex(start) - monthIndex(anchor);
  if (diff < 0 || diff % n !== 0) return out;
  const d = addMonths(anchor, diff);
  if (d >= start && d <= end) out.push(d);
  return out;
}

/**
 * Everything on the calendar for one month: expected subscription charges from today on, bill due
 * dates, and receipts for days already past. Past days are never projected from a cadence.
 */
export function chargesForMonth(
  data: { subscriptions: Subscription[]; bills: BillItem[]; receipts: PastCharge[] },
  year: number,
  month: number,
  today: string
): CalendarEntry[] {
  const { start, end } = monthBounds(year, month);
  const out: CalendarEntry[] = [];

  for (const s of data.subscriptions) {
    if (s.status === "cancelled" || !s.nextChargeDate) continue;
    const dates = s.cadence ? occurrences(s.nextChargeDate, s.cadence, start, end) : [s.nextChargeDate].filter((d) => d >= start && d <= end);
    for (const date of dates) {
      if (date < today) continue;
      out.push({ date, merchant: s.merchant, merchantKey: s.merchantKey, amount: s.amount, currency: s.currency, kind: "subscription" });
    }
  }
  for (const b of data.bills) {
    if (b.dueDate < start || b.dueDate > end) continue;
    out.push({ date: b.dueDate, merchant: b.merchant, merchantKey: b.merchantKey, amount: b.amount, currency: b.currency, kind: "bill", paid: b.paid });
  }
  for (const r of data.receipts) {
    if (r.date < start || r.date > end || r.date >= today) continue;
    out.push({ date: r.date, merchant: r.merchant, merchantKey: r.merchantKey, amount: r.amount, currency: r.currency, kind: "charged" });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.merchant.localeCompare(b.merchant));
}
