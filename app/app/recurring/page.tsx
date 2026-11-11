import { Suspense } from "react";
import RecurringView, { type SubRow } from "@/components/RecurringView";
import { ConnectGmailEmpty } from "@/components/ConnectGmail";
import { loadApp } from "@/lib/app-data";
import { CATEGORY_LABELS, categoryFor } from "@/lib/categories";
import { daysBetween } from "@/lib/extract/dates";
import { hostOf, money, relDays, shortDate } from "@/lib/format";
import type { Subscription } from "@/lib/types";
import { monthlyOf, PER, subscriptionSubtitle } from "@/lib/views";

export const metadata = { title: "Recurring | Subwatch" };

export default function RecurringPage() {
  return (
    <Suspense fallback={<div className="page-head"><h1>Recurring</h1></div>}>
      <Recurring />
    </Suspense>
  );
}

function priceTag(s: Subscription, today: string): string | null {
  const pc = s.priceChange;
  if (!pc || !pc.effective) return null;
  if (pc.effective >= today) return `${pc.from !== null && pc.to < pc.from ? "Drops" : "Rises"} ${shortDate(pc.effective, Number(today.slice(0, 4)))}`;
  if (pc.from === null) return null;
  const diff = Math.round((pc.to - pc.from) * 100) / 100;
  return diff > 0 ? `Up ${money(diff)}` : `Down ${money(-diff)}`;
}

function toRow(s: Subscription, today: string): SubRow {
  const refYear = Number(today.slice(0, 4));
  const cat = categoryFor(s.merchantKey);
  const days = s.nextChargeDate ? daysBetween(today, s.nextChargeDate) : null;
  const yearly = s.annualCost;
  return {
    merchantKey: s.merchantKey,
    merchant: s.merchant,
    category: cat,
    categoryLabel: CATEGORY_LABELS[cat],
    status: s.status,
    amountLabel: money(s.amount, s.currency),
    per: s.cadence ? PER[s.cadence] : "",
    yearly,
    yearlyLabel: yearly !== null ? money(yearly, s.currency) : "Unknown",
    monthly: monthlyOf(s),
    nextDate: s.nextChargeDate,
    nextLabel: s.nextChargeDate ? shortDate(s.nextChargeDate, refYear) : "Date unknown",
    rel: days !== null ? relDays(days) : "",
    relUrgent: days !== null && days <= 3,
    subtitle: subscriptionSubtitle(s, today),
    priceTag: priceTag(s, today),
    cancelUrl: s.cancelUrl,
    host: s.cancelUrl ? hostOf(s.cancelUrl) : null,
    trusted: s.cancelUrlTrusted,
    emails: s.evidenceEmailIds.length,
    manualCancel: s.manualCancel,
    cancelledNote: s.manualCancel
      ? `Marked cancelled here.${yearly ? ` Saves ${money(yearly, s.currency)} a year.` : ""}`
      : `Cancellation email received.${s.lastChargeDate ? ` Last charged ${shortDate(s.lastChargeDate, refYear)}.` : ""}`,
  };
}

async function Recurring() {
  const { dashboard, today, connected } = await loadApp();
  if (!connected) return <ConnectGmailEmpty title="Recurring" />;
  return <RecurringView rows={dashboard.subscriptions.map((s) => toRow(s, today))} />;
}
