import { CATEGORY_LABELS, categoryFor, type Category } from "./categories";
import { addDays } from "./extract/dates";
import { cadenceLabel, money, shortDate } from "./format";
import type { Cadence, Dashboard, Subscription } from "./types";

// Pure view models for the /app pages. No React, so the rules are unit tested.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const PER: Record<Cadence, string> = { weekly: "a week", monthly: "a month", quarterly: "a quarter", yearly: "a year" };

export interface AttentionItem {
  key: string;
  title: string;
  sub: string;
  urgent: boolean; // mauve dot and text
  action: string;
  href: string;
  sortDate: string;
}

const ATTENTION_DAYS = 7;
const REMINDER_DAYS = 2;
const PRICE_LOOKBACK_DAYS = 45;

export function attentionItems(d: Dashboard, today: string): AttentionItem[] {
  const refYear = Number(today.slice(0, 4));
  const out: AttentionItem[] = [];
  const subByKey = new Map(d.subscriptions.map((s) => [s.merchantKey, s]));

  for (const x of d.due) {
    if (x.kind === "payment_due") {
      if (x.paid) continue;
      const overdue = x.daysAway < 0;
      const reminded = x.reminder && x.daysAway >= 0 && x.daysAway <= REMINDER_DAYS;
      if (!overdue && !reminded) continue;
      out.push({
        key: x.key,
        title: `${x.merchant} bill ${overdue ? "is overdue" : `due ${shortDate(x.date, refYear)}`}`,
        sub: `${overdue ? `${-x.daysAway} days late` : relWords(x.daysAway)}${x.amount !== null ? `, ${money(x.amount, x.currency)}` : ""}`,
        urgent: true,
        action: "Open bills",
        href: "/app/bills",
        sortDate: x.date,
      });
      continue;
    }
    if (x.daysAway < 0 || x.daysAway > ATTENTION_DAYS) continue;
    const sub = subByKey.get(x.merchantKey);
    const per = sub?.cadence ? ` ${PER[sub.cadence]}` : "";
    const amt = x.amount !== null ? money(x.amount, x.currency) : null;
    if (x.kind === "trial_ending") {
      out.push({
        key: x.key,
        title: `${x.merchant} free trial converts ${shortDate(x.date, refYear)}`,
        sub: `${capital(relWords(x.daysAway))}${amt ? `, then ${amt}${per}` : ""}`,
        urgent: true,
        action: "Cancel trial",
        href: "/app/recurring",
        sortDate: x.date,
      });
    } else {
      out.push({
        key: x.key,
        title: `${x.merchant} renews ${x.daysAway <= 1 ? relWords(x.daysAway) : shortDate(x.date, refYear)}`,
        sub: [amt, sub?.cadence ? `billed ${cadenceLabel(sub.cadence)}` : null].filter(Boolean).join(", ") || "Amount unknown",
        urgent: true,
        action: "Review",
        href: "/app/recurring",
        sortDate: x.date,
      });
    }
  }

  for (const s of d.subscriptions) {
    const pc = s.priceChange;
    if (!pc || s.status === "cancelled" || !pc.effective) continue;
    const per = s.cadence ? ` ${PER[s.cadence]}` : "";
    const range = pc.from !== null ? `${money(pc.from, s.currency)} to ${money(pc.to, s.currency)}${per}` : `Now ${money(pc.to, s.currency)}${per}`;
    if (pc.effective >= today) {
      out.push({ key: `price|${s.merchantKey}`, title: `${s.merchant} price ${pc.from !== null && pc.to < pc.from ? "drops" : "rises"} ${shortDate(pc.effective, refYear)}`, sub: range, urgent: false, action: "See details", href: "/app/recurring", sortDate: pc.effective });
    } else if (addDays(pc.effective, PRICE_LOOKBACK_DAYS) >= today && pc.from !== null) {
      const month = MONTHS[Number(pc.effective.slice(5, 7)) - 1];
      out.push({ key: `price|${s.merchantKey}`, title: `${s.merchant} went ${pc.to > pc.from ? "up" : "down"} in ${month}`, sub: range, urgent: false, action: "See details", href: "/app/recurring", sortDate: "9999" });
    }
  }
  return out.sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.title.localeCompare(b.title));
}

function relWords(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  return `in ${n} days`;
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthlyOf(s: Subscription): number {
  return s.annualCost !== null ? s.annualCost / 12 : 0;
}

/** Monthly cost by category for active subscriptions (trials and cancelled excluded), biggest first. */
export function categoryTotals(d: Dashboard): { category: Category; label: string; monthly: number }[] {
  const sums = new Map<Category, number>();
  for (const s of d.subscriptions) {
    if (s.status !== "active") continue;
    const c = categoryFor(s.merchantKey);
    sums.set(c, (sums.get(c) ?? 0) + monthlyOf(s));
  }
  return [...sums]
    .map(([category, v]) => ({ category, label: CATEGORY_LABELS[category], monthly: Math.round(v * 100) / 100 }))
    .filter((x) => x.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);
}

export interface DayPoint {
  date: string;
  subs: number;
  bills: number;
  items: { merchant: string; amount: number }[];
}

/** One point per day from today for `days` days, from the upcoming list. */
export function dailySeries(d: Dashboard, today: string, days: number): DayPoint[] {
  const out: DayPoint[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const items = d.upcoming.filter((u) => u.date === date);
    out.push({
      date,
      subs: round(items.filter((u) => u.source === "subscription").reduce((a, u) => a + (u.amount ?? 0), 0)),
      bills: round(items.filter((u) => u.source === "bill").reduce((a, u) => a + (u.amount ?? 0), 0)),
      items: items.map((u) => ({ merchant: u.merchant, amount: u.amount ?? 0 })),
    });
  }
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** What we actually know about a subscription, in place of the mockup's plan names. */
export function subscriptionSubtitle(s: Subscription, today: string): string {
  const refYear = Number(today.slice(0, 4));
  if (s.status === "trial") {
    return s.amount !== null ? `Trial converts to ${money(s.amount, s.currency)}${s.cadence ? ` ${PER[s.cadence]}` : ""}` : "Free trial";
  }
  const parts: string[] = [];
  if (s.cadence) parts.push(`Billed ${cadenceLabel(s.cadence)}`);
  if (s.lastChargeDate) parts.push(`${parts.length ? "last" : "Last"} charged ${shortDate(s.lastChargeDate, refYear)}`);
  if (!parts.length) return `Found in ${s.evidenceEmailIds.length} email${s.evidenceEmailIds.length === 1 ? "" : "s"}`;
  return parts.join(", ");
}
