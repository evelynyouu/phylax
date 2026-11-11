import { addDays, addMonths, daysBetween, todayIso } from "./extract/dates";
import { billKey } from "./calendar";
import type { SubscriptionEdit } from "./store/types";
import type { BillItem, Cadence, Dashboard, DueItem, ExtractedRecord, PastCharge, Subscription, UpcomingPayment } from "./types";

const PERIODS_PER_YEAR: Record<Cadence, number> = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 };
const UPCOMING_WINDOW_DAYS = 60;
const OVERDUE_GRACE_DAYS = 14;

export function advance(iso: string, cadence: Cadence): string {
  switch (cadence) {
    case "weekly": return addDays(iso, 7);
    case "monthly": return addMonths(iso, 1);
    case "quarterly": return addMonths(iso, 3);
    case "yearly": return addMonths(iso, 12);
  }
}

/** Roll a date forward by one cadence period at a time until it is not in the past. */
export function rollForward(iso: string, cadence: Cadence, today: string): string {
  let d = iso;
  for (let i = 0; i < 200 && d < today; i++) d = advance(d, cadence);
  return d;
}

function inferCadence(dates: string[]): Cadence | null {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1], sorted[i]));
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median >= 5 && median <= 9) return "weekly";
  if (median >= 25 && median <= 35) return "monthly";
  if (median >= 80 && median <= 100) return "quarterly";
  if (median >= 350 && median <= 380) return "yearly";
  return null;
}

function mostRecent<T extends { emailDate: string }>(items: T[]): T | undefined {
  return items.reduce<T | undefined>((best, r) => (!best || r.emailDate > best.emailDate ? r : best), undefined);
}

function modeCadence(records: ExtractedRecord[]): Cadence | null {
  const withCad = records.filter((r) => r.cadence).sort((a, b) => a.emailDate.localeCompare(b.emailDate));
  if (!withCad.length) return null;
  const counts = new Map<Cadence, number>();
  for (const r of withCad) counts.set(r.cadence!, (counts.get(r.cadence!) ?? 0) + 1);
  let best: Cadence = withCad[withCad.length - 1].cadence!;
  let bestN = counts.get(best)!;
  for (const [c, n] of counts) if (n > bestN) { best = c; bestN = n; }
  return best;
}

const day = (iso: string) => iso.slice(0, 10);
/** When a receipt's money moved. Records saved before chargeDate existed fall back to the email date. */
const chargeDay = (r: ExtractedRecord) => r.chargeDate ?? day(r.emailDate);
const STALE_GRACE_DAYS = 7;

/** A receipt is recurring if it states a cadence or its amount appears on 2+ receipts of the merchant. */
export function isRecurringReceipt(r: ExtractedRecord, sameMerchantReceipts: ExtractedRecord[]): boolean {
  return !!r.cadence || sameMerchantReceipts.filter((o) => o.amount === r.amount).length >= 2;
}

function buildSubscription(key: string, group: ExtractedRecord[], today: string, manualAt?: string): Subscription | null {
  // A receipt only counts toward a subscription if it states a cadence or the same amount repeats.
  // This keeps one-off purchases (e.g. an Amazon order) from masquerading as the recurring charge.
  const allReceipts = group.filter((r) => r.kind === "receipt" && r.amount !== null);
  const receipts = allReceipts.filter((r) => isRecurringReceipt(r, allReceipts));
  const renewals = group.filter((r) => r.kind === "renewal_notice");
  const trials = group.filter((r) => r.kind === "trial_ending");
  const priceChanges = group.filter((r) => r.kind === "price_change" && r.amount !== null);
  const cancellations = group.filter((r) => r.kind === "cancellation");

  const lastReceipt = mostRecent(receipts);
  const lastChargeDate = lastReceipt ? chargeDay(lastReceipt) : null;

  // A trial only counts while it is still running and nothing has been charged since.
  const liveTrial = mostRecent(
    trials.filter((t) => t.dueDate && t.dueDate >= today && (!lastChargeDate || day(t.emailDate) > lastChargeDate))
  );

  const cadence = modeCadence(group) ?? inferCadence(receipts.map(chargeDay));

  // Decide whether this merchant is a subscription at all.
  const hasRecurringSignal = !!cadence || renewals.length > 0 || !!liveTrial;
  if (!hasRecurringSignal) return null;
  if (!receipts.length && !renewals.length && !liveTrial && !priceChanges.length) return null;

  // Never charged, and the announced renewal or trial end came and went with no receipt: stale.
  if (!group.some((r) => r.kind === "receipt")) {
    const announced = [...renewals.map((r) => r.renewalDate), ...trials.map((t) => t.dueDate ?? t.renewalDate)].filter(
      (d): d is string => !!d
    );
    const latest = announced.sort().pop();
    if (latest && daysBetween(latest, today) > STALE_GRACE_DAYS) return null;
  }

  // Status
  const lastCancel = mostRecent(cancellations);
  const cancelled =
    !!lastCancel && (!lastChargeDate || day(lastCancel.emailDate) >= lastChargeDate) &&
    !renewals.some((r) => r.emailDate > lastCancel.emailDate);
  // "I've cancelled it" holds until a receipt newer than the moment the user said so.
  // One-off purchases (non-recurring receipts) do not count as a newer charge.
  const newestReceipt = mostRecent(receipts);
  const manual = !!manualAt && (!newestReceipt || newestReceipt.emailDate <= manualAt);
  const isCancelled = cancelled || manual;
  const status: Subscription["status"] = isCancelled ? "cancelled" : liveTrial ? "trial" : "active";

  // Amount: latest concrete charge, else latest announced amount.
  const lastRenewal = mostRecent(renewals.filter((r) => r.amount !== null));
  const amount =
    lastReceipt?.amount ??
    lastRenewal?.amount ??
    liveTrial?.amount ??
    mostRecent(priceChanges)?.amount ??
    null;

  // Price change: from receipts, or from an announcement that differs from the latest receipt.
  let priceChange: Subscription["priceChange"] = null;
  const sortedReceipts = [...receipts].sort((a, b) => a.emailDate.localeCompare(b.emailDate));
  if (sortedReceipts.length >= 2) {
    const prev = sortedReceipts[sortedReceipts.length - 2];
    const last = sortedReceipts[sortedReceipts.length - 1];
    if (prev.amount !== last.amount && daysBetween(chargeDay(last), today) <= 90) {
      priceChange = { from: prev.amount, to: last.amount!, effective: chargeDay(last) };
    }
  }
  const announced = mostRecent(priceChanges);
  if (
    announced &&
    (!lastChargeDate || day(announced.emailDate) >= lastChargeDate) &&
    announced.amount !== (lastReceipt?.amount ?? null) &&
    (!announced.renewalDate || announced.renewalDate >= today)
  ) {
    priceChange = { from: lastReceipt?.amount ?? null, to: announced.amount!, effective: announced.renewalDate };
  }
  // The price a user will actually pay next: use the announced one.
  const effectiveAmount = priceChange && priceChange.effective && priceChange.effective >= today ? priceChange.to : amount;

  // Next charge date
  let nextChargeDate: string | null = null;
  if (!isCancelled) {
    const dated = [...group]
      .filter((r) => r.kind !== "price_change" && r.kind !== "cancellation")
      .sort((a, b) => b.emailDate.localeCompare(a.emailDate));
    for (const r of dated) {
      const candidate = r.kind === "trial_ending" ? r.renewalDate ?? r.dueDate : r.renewalDate;
      if (!candidate) continue;
      nextChargeDate = candidate >= today ? candidate : cadence ? rollForward(candidate, cadence, today) : null;
      if (nextChargeDate) break;
    }
    if (!nextChargeDate && lastChargeDate && cadence) {
      nextChargeDate = rollForward(advance(lastChargeDate, cadence), cadence, today);
    }
  }

  // Cancel link: newest trusted link wins, otherwise the newest untrusted one (shown with a warning).
  const withLink = group.filter((r) => r.cancelUrl).sort((a, b) => b.emailDate.localeCompare(a.emailDate));
  const pick = withLink.find((r) => r.cancelUrlTrusted) ?? withLink[0];

  const latestName = mostRecent(group.filter((r) => r.merchant))?.merchant ?? key;
  // Nothing to show: no amount and no date of any kind.
  const anyRenewalDate = group.some((r) => r.renewalDate);
  if (effectiveAmount === null && !nextChargeDate && !lastChargeDate && !anyRenewalDate) return null;

  const annual = effectiveAmount !== null && cadence ? Math.round(effectiveAmount * PERIODS_PER_YEAR[cadence] * 100) / 100 : null;

  return {
    merchantKey: key,
    merchant: latestName,
    status,
    amount: effectiveAmount,
    currency: lastReceipt?.currency ?? lastRenewal?.currency ?? "USD",
    cadence,
    lastChargeDate,
    nextChargeDate,
    priceChange,
    cancelUrl: isCancelled ? null : pick?.cancelUrl ?? null,
    cancelUrlTrusted: isCancelled ? false : pick?.cancelUrlTrusted ?? false,
    evidenceEmailIds: group.map((r) => r.emailId),
    annualCost: annual,
    manualCancel: manual,
    edited: false,
    manual: false,
  };
}

const annualOf = (amount: number | null, cadence: Cadence | null) =>
  amount !== null && cadence ? Math.round(amount * PERIODS_PER_YEAR[cadence] * 100) / 100 : null;

/**
 * The user's corrections win over what the emails said, and survive re-scans because they are stored
 * apart from the records. A manual entry with no email subscription becomes its own subscription.
 */
function applyEdits(subscriptions: Subscription[], edits: SubscriptionEdit[], dismissed: Set<string>, today: string) {
  for (const e of edits) {
    if (dismissed.has(e.merchantKey)) continue;
    const next = (d: string | null, cadence: Cadence | null) => (d && cadence ? rollForward(d, cadence, today) : d);
    const existing = subscriptions.find((s) => s.merchantKey === e.merchantKey);
    if (existing) {
      if (e.merchant !== null) existing.merchant = e.merchant;
      if (e.amount !== null) existing.amount = e.amount;
      if (e.currency !== null) existing.currency = e.currency;
      if (e.cadence !== null) existing.cadence = e.cadence;
      if (e.nextChargeDate !== null) existing.nextChargeDate = next(e.nextChargeDate, existing.cadence);
      existing.annualCost = annualOf(existing.amount, existing.cadence);
      existing.edited = true;
      continue;
    }
    if (!e.manual) continue; // a correction for a merchant that is no longer found has nothing to correct
    const nextChargeDate = next(e.nextChargeDate, e.cadence);
    if (e.amount === null && nextChargeDate === null) continue; // nothing to show (same rule as email subscriptions)
    subscriptions.push({
      merchantKey: e.merchantKey,
      merchant: e.merchant ?? e.merchantKey,
      status: "active",
      amount: e.amount,
      currency: e.currency ?? "USD",
      cadence: e.cadence,
      lastChargeDate: null,
      nextChargeDate,
      priceChange: null,
      cancelUrl: null,
      cancelUrlTrusted: false,
      evidenceEmailIds: [],
      annualCost: annualOf(e.amount, e.cadence),
      manualCancel: false,
      edited: false,
      manual: true,
    });
  }
}

export function buildDashboard(
  all: ExtractedRecord[],
  opts: {
    today?: string;
    dismissed?: Set<string>;
    manualCancels?: Map<string, string>; // merchantKey -> ISO time the user marked it cancelled
    paid?: Set<string>; // bill keys
    reminders?: Set<string>; // bill keys
    edits?: SubscriptionEdit[]; // the user's corrections and hand-added recurring payments
  } = {}
): Dashboard {
  const today = opts.today ?? process.env.SUBWATCH_TODAY ?? todayIso();
  const dismissed = opts.dismissed ?? new Set<string>();
  const manualCancels = opts.manualCancels ?? new Map<string, string>();
  const paid = opts.paid ?? new Set<string>();
  const reminders = opts.reminders ?? new Set<string>();

  const relevant = all.filter((r) => r.relevant && r.merchantKey && !dismissed.has(r.merchantKey));
  const groups = new Map<string, ExtractedRecord[]>();
  for (const r of relevant) {
    const g = groups.get(r.merchantKey!) ?? [];
    g.push(r);
    groups.set(r.merchantKey!, g);
  }

  // ---- subscriptions ----
  const subscriptions: Subscription[] = [];
  for (const [key, group] of groups) {
    const s = buildSubscription(key, group, today, manualCancels.get(key));
    if (s) subscriptions.push(s);
  }
  applyEdits(subscriptions, opts.edits ?? [], dismissed, today);
  const statusRank = { active: 0, trial: 1, cancelled: 2 } as const;
  subscriptions.sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      (a.nextChargeDate ?? "9999").localeCompare(b.nextChargeDate ?? "9999") ||
      a.merchant.localeCompare(b.merchant)
  );

  // ---- upcoming payments ----
  const windowEnd = addDays(today, UPCOMING_WINDOW_DAYS);
  const upcoming: UpcomingPayment[] = [];
  for (const s of subscriptions) {
    if (s.status === "cancelled" || !s.nextChargeDate) continue;
    let d = s.nextChargeDate;
    for (let i = 0; i < 3 && d <= windowEnd; i++) {
      upcoming.push({
        merchant: s.merchant,
        merchantKey: s.merchantKey,
        amount: s.amount,
        currency: s.currency,
        date: d,
        source: "subscription",
        daysAway: daysBetween(today, d),
      });
      if (!s.cadence) break;
      d = advance(d, s.cadence);
    }
  }

  // Bills: newest email per merchant and due date.
  const bills = new Map<string, ExtractedRecord>();
  for (const r of relevant) {
    if (r.kind !== "payment_due" || !r.dueDate) continue;
    const k = `${r.merchantKey}|${r.dueDate}`;
    const prev = bills.get(k);
    if (!prev || r.emailDate > prev.emailDate) bills.set(k, r);
  }
  const billItems: BillItem[] = [];
  for (const r of bills.values()) {
    const key = billKey(r.merchantKey!, r.dueDate!);
    billItems.push({
      key,
      merchantKey: r.merchantKey!,
      merchant: r.merchant!,
      amount: r.amount,
      currency: r.currency ?? "USD",
      dueDate: r.dueDate!,
      paid: paid.has(key),
      reminder: reminders.has(key),
    });
    // A paid bill is no longer money about to leave.
    if (r.dueDate! < today || r.dueDate! > windowEnd || paid.has(key)) continue;
    upcoming.push({
      merchant: r.merchant!,
      merchantKey: r.merchantKey!,
      amount: r.amount,
      currency: r.currency ?? "USD",
      date: r.dueDate!,
      source: "bill",
      daysAway: daysBetween(today, r.dueDate!),
    });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.merchant.localeCompare(b.merchant));

  // ---- due dates ----
  const due: DueItem[] = [];
  const seen = new Set<string>();
  const newestFirst = [...relevant].sort((a, b) => b.emailDate.localeCompare(a.emailDate));
  const subByKey = new Map(subscriptions.map((s) => [s.merchantKey, s]));
  for (const r of newestFirst) {
    let date: string | null = null;
    let label = "";
    if (r.kind === "payment_due" && r.dueDate && daysBetween(today, r.dueDate) >= -OVERDUE_GRACE_DAYS) {
      date = r.dueDate;
      label = "Payment due";
    } else if (r.kind === "trial_ending" && r.dueDate && r.dueDate >= today) {
      date = r.dueDate;
      label = "Free trial ends";
    } else if (r.kind === "renewal_notice" && r.renewalDate && r.renewalDate >= today) {
      date = r.renewalDate;
      label = "Auto-renews";
    }
    if (!date) continue;
    const dedupe = `${r.merchantKey}|${r.kind}|${date}`;
    if (seen.has(dedupe)) continue;
    // Skip renewals and trials for subscriptions we already know are cancelled.
    const sub = subByKey.get(r.merchantKey!);
    if (sub?.status === "cancelled" && r.kind !== "payment_due") continue;
    seen.add(dedupe);
    const isBill = r.kind === "payment_due";
    const key = isBill ? billKey(r.merchantKey!, date) : dedupe;
    due.push({
      key,
      merchant: r.merchant!,
      merchantKey: r.merchantKey!,
      label,
      amount: r.amount,
      currency: r.currency ?? "USD",
      date,
      daysAway: daysBetween(today, date),
      kind: r.kind as DueItem["kind"],
      cancelUrl: r.kind === "payment_due" ? null : sub?.cancelUrl ?? r.cancelUrl,
      cancelUrlTrusted: r.kind === "payment_due" ? false : sub?.cancelUrl ? sub.cancelUrlTrusted : r.cancelUrlTrusted,
      paid: isBill && paid.has(key),
      reminder: isBill && reminders.has(key),
    });
  }
  due.sort((a, b) => a.date.localeCompare(b.date) || a.merchant.localeCompare(b.merchant));

  billItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.merchant.localeCompare(b.merchant));

  // Past charges for the calendar: receipts from merchants we track as subscriptions.
  const subKeys = new Set(subscriptions.map((s) => s.merchantKey));
  const receiptsByMerchant = new Map<string, ExtractedRecord[]>();
  for (const r of relevant) {
    if (r.kind !== "receipt" || r.amount === null || !subKeys.has(r.merchantKey!)) continue;
    receiptsByMerchant.set(r.merchantKey!, [...(receiptsByMerchant.get(r.merchantKey!) ?? []), r]);
  }
  const receipts: PastCharge[] = [...receiptsByMerchant.values()]
    .flatMap((list) => list.filter((r) => isRecurringReceipt(r, list)))
    .map((r) => ({
      merchantKey: r.merchantKey!,
      merchant: subscriptions.find((s) => s.merchantKey === r.merchantKey)!.merchant,
      amount: r.amount,
      currency: r.currency ?? "USD",
      date: chargeDay(r),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const active = subscriptions.filter((s) => s.status === "active");
  const yearly = active.reduce((sum, s) => sum + (s.annualCost ?? 0), 0);
  return {
    generatedAt: new Date().toISOString(),
    subscriptions,
    upcoming,
    due,
    bills: billItems,
    receipts,
    totals: {
      monthly: Math.round((yearly / 12) * 100) / 100,
      yearly: Math.round(yearly * 100) / 100,
      count: subscriptions.filter((s) => s.status !== "cancelled").length,
    },
  };
}
