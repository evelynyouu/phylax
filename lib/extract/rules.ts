import type { Cadence, EmailKind, ExtractedRecord, RawEmail } from "../types";
import { findDates, type FoundDate } from "./dates";
import { isTrustedLink, resolveMerchant } from "./merchant";

// ---------- classification ----------

const SUBJECT_RULES: [EmailKind, RegExp][] = [
  [
    "cancellation",
    /(cancell?ation (confirm|complete|notice)|(has|have) been cancell?ed|was cancell?ed|membership (has )?ended|we['’]?ve cancell?ed|sorry to see you go)/i,
  ],
  ["trial_ending", /(trial (is |will )?(be )?(ending|ends|end|expir)|free trial.*(end|expir)|trial.*(last day|days left))/i],
  [
    "price_change",
    /(price (change|increase)|(pricing|rates?) (is |are )?(changing|increas)|changes? to your (plan|price|subscription))/i,
  ],
  [
    "payment_due",
    /(payment (is )?due|amount due|bill is (ready|available)|statement is (ready|available)|invoice.*due|past due|due (on|by|soon)|autopay|your .{1,30} bill\b)/i,
  ],
  ["renewal_notice", /(renew|upcoming (charge|payment)|will be charged|next billing|subscription (is )?(expiring|expires))/i],
  [
    "receipt",
    /(receipt|invoice|payment (received|confirmation|successful|processed)|thanks? for your (payment|purchase|order)|you['’]?ve been charged|your (?:[\w.&]+ ){0,3}order)/i,
  ],
];

const BODY_RULES: [EmailKind, RegExp][] = [
  ["cancellation", /your (subscription|membership|plan|account).{0,40}(has been|was) cancell?ed/i],
  ["trial_ending", /trial.{0,40}(ends?|expires?|ending)/i],
  ["payment_due", /((payment|amount|balance) (is )?due|due (on|by) )/i],
  [
    "receipt",
    /(receipt|you['’]?ve been charged|payment (received|successful)|thank you for your payment|total charged|amount (charged|paid))/i,
  ],
  ["renewal_notice", /(will (automatically )?renew|auto-?renew|will be charged on|next (billing|payment) date)/i],
  ["price_change", /(price (will )?(change|increase)|new price)/i],
];

const MARKETING_SUBJECT =
  /(\d+% off|\bsale\b|\bdeals?\b|save \$?\d|limited time|ends? (today|tonight|tomorrow|friday|soon|sunday|monday)|flash|exclusive offer|newsletter|digest|webinar|new feature)/i;

const BILLING_SIGNAL = /(\$|€|£)\s?\d|invoice|receipt|subscription|renew|trial|billing|payment|charged/i;

// Promotional mail: unsubscribe footers, shipping offers, shop calls to action, discounts.
const MARKETING_BODY = /(unsubscribe|free (standard |express )?(shipping|delivery)|shop now|\bsale\b|\d+% off)/i;
// Evidence that money actually moved. A bare "gift receipts" mention does not count.
const TRANSACTIONAL =
  /(order (number|no\.?|#)|order\s?#|(?<!gift )\breceipt\b(?!s)|your order|payment (received|successful|confirmation)|invoice|\bcharged\b|thanks? (you )?for your (purchase|order|payment))/i;

// Renewal language about a plan the user already has.
const EXISTING_PLAN_RENEWAL =
  /(will (automatically |auto-?)?renew|auto-?renew|set to (automatically )?renew|scheduled to (automatically )?renew|renews (on|automatically|every)|will be charged|upcoming (charge|payment)|next (billing|payment|charge)( date)?|renewal (date|amount|price|charge)|your (current )?(subscription|membership|plan) (renews|is (expiring|renewing)|expires))/i;
// Sales offers and option menus that use the word "renew" to sell something new.
const RENEWAL_OFFER =
  /(renew now|final day to renew|last (call|chance)|for just [$€£]|secure your (seat|spot)|\byour options\b|choose (a|your) (plan|option)|plan options|select (a|your) plan|don['’]t miss)/i;
const SUBSCRIPTION_CONTEXT = /(subscription|membership|\bplan\b|billing)/i;
const NON_SUBSCRIPTION_TOPIC = /(\bgrant\b|\blease\b|licen[cs]e|eligib|survey|scholarship|financial aid|passport|registration)/i;
const MONEY = /[$€£]\s?\d|\d\s?(USD|EUR|GBP)\b/;

/** "renew" alone is not a renewal notice: it must be about a plan the user already pays for. */
function refineRenewal(subject: string, body: string): EmailKind {
  const text = `${subject}\n${body}`;
  if (EXISTING_PLAN_RENEWAL.test(text)) return "renewal_notice";
  if (RENEWAL_OFFER.test(text)) return "marketing";
  const money = MONEY.test(text);
  if (!money && (NON_SUBSCRIPTION_TOPIC.test(text) || !SUBSCRIPTION_CONTEXT.test(text))) return "other";
  const datedRenewal = findDates(text, new Date().toISOString()).some((d) => labelDate(d, text) === "renewal");
  if (datedRenewal) return "renewal_notice";
  return money ? "marketing" : "other";
}

function refine(kind: EmailKind, subject: string, body: string): EmailKind {
  const text = `${subject}\n${body}`;
  if (kind === "renewal_notice") return refineRenewal(subject, body);
  if (kind === "receipt" && MARKETING_BODY.test(text) && !TRANSACTIONAL.test(text)) return "marketing";
  return kind;
}

export function classify(subject: string, body: string): { kind: EmailKind; source: "subject" | "body" | "none" } {
  // Refunds look like order receipts but are money coming back, not something owed.
  if (/\brefund(ed|s)?\b/i.test(subject)) return { kind: "other", source: "subject" };
  for (const [kind, re] of SUBJECT_RULES) {
    if (re.test(subject)) return { kind: refine(kind, subject, body), source: "subject" };
  }
  if (MARKETING_SUBJECT.test(subject)) return { kind: "marketing", source: "subject" };
  for (const [kind, re] of BODY_RULES) {
    if (re.test(body)) return { kind: refine(kind, subject, body), source: "body" };
  }
  return { kind: "other", source: "none" };
}

// ---------- amounts ----------

const CURRENCY: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", USD: "USD", EUR: "EUR", GBP: "GBP" };

// "$9.99" / "€10" / "£5.00", or a bare number followed by an ISO code: "709.40 USD", "1,234.00 EUR".
const AMOUNT_RE =
  /([$€£])\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?|(?<![\d.,$€£])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?\s?(USD|EUR|GBP)\b/g;

// Legal, insurance and liability fine print quotes dollar figures that are never what the user paid.
const FINE_PRINT =
  /(limited to|liabilit|penalt|fine of|up to|maximum|coverage|insured|insurance|compensation|imprisonment)/;

const PROMO_BEFORE =
  /(spend|(orders?|purchases?) (over|of|above|at least|more than)|free (standard |express )?(shipping|delivery)( [\w-]+){0,4} (on|over)|minimum( order| purchase)?( of)?)\W*$/;

export function pickAmount(text: string): { amount: number; currency: string } | null {
  let best: { amount: number; currency: string; score: number; index: number } | null = null;

  for (const m of text.matchAll(AMOUNT_RE)) {
    const i = m.index!;
    const symbol = m[1] ?? m[6];
    const whole = m[2] ?? m[4];
    const cents = m[3] ?? m[5];
    const before = text.slice(Math.max(0, i - 70), i).toLowerCase();
    const near = text.slice(Math.max(0, i - 25), i).toLowerCase();
    // The fine-print check looks only at the current sentence or line, so a total that follows a
    // liability sentence is not penalized for it.
    const clause = before.split(/\.\s|\n/).pop() ?? "";
    let score = 0;
    const after = text.slice(i + m[0].length, i + m[0].length + 20).toLowerCase();
    if (/(total|amount (due|charged|paid)|payment amount|you['’]ll be charged|will be charged|charged|payment of|balance due|new price|billed|(auto-?)?renews? for|(membership|subscription|plan|annual) (fee|price))/.test(before))
      score += 3;
    if (/(subtotal|tax|(?<!(membership|subscription|plan|annual) )fee|discount|save|off|credit|was|from|saving)\W*$/.test(near)) score -= 3;
    if (FINE_PRINT.test(clause)) score -= 3;
    // A price with a period ("$12.95/month", "$ 12.95 /month") is what the plan costs.
    if (/^\s{0,2}(\/|per\b|a\b)\s{0,2}(month|mo|year|yr|week|wk|quarter)\b/.test(after)) score += 2;
    // Promo thresholds: "spend $50 or more", "orders over $49", "$35+ orders", "minimum order $25".
    if (PROMO_BEFORE.test(clause) || /^(\+|\s?or more|\s?and up)/.test(after)) score -= 5;
    const amount = parseFloat(whole.replace(/,/g, "") + (cents ? "." + cents : ""));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) continue;
    if (!best || score > best.score || (score === best.score && i > best.index)) {
      best = { amount, currency: CURRENCY[symbol], score, index: i };
    }
  }
  if (!best || best.score < 0) return null;
  return { amount: best.amount, currency: best.currency };
}

// ---------- dates ----------

const RENEWAL_LABEL =
  /(renews?|renewal|next (billing|payment|charge)( date)?|will be charged( on)?|charged on|billing date|auto-?renews?|effective|starting on|beginning on|take[s]? effect)/g;
const DUE_LABEL =
  /(\bdue\b|pay by|pay before|expires?|expiration|expiry|trial (ends|end)|ends on|ending on|last day|deadline|ends)/g;

function lastLabelIndex(re: RegExp, s: string): number {
  let last = -1;
  for (const m of s.matchAll(re)) last = m.index!;
  return last;
}

function labelDate(d: FoundDate, text: string): "renewal" | "due" | null {
  const before = text.slice(Math.max(0, d.index - 60), d.index).toLowerCase();
  const r = lastLabelIndex(RENEWAL_LABEL, before);
  const due = lastLabelIndex(DUE_LABEL, before);
  if (r < 0 && due < 0) return null;
  return r > due ? "renewal" : "due";
}

export function assignDates(
  text: string,
  dates: FoundDate[],
  kind: EmailKind
): { dueDate: string | null; renewalDate: string | null } {
  let dueDate: string | null = null;
  let renewalDate: string | null = null;
  for (const d of dates) {
    const label = labelDate(d, text);
    if (label === "renewal" && !renewalDate) renewalDate = d.iso;
    if (label === "due" && !dueDate) dueDate = d.iso;
  }
  const distinct = [...new Set(dates.map((d) => d.iso))];

  switch (kind) {
    case "receipt":
      // A receipt's own dates are billing periods; only trust an explicit renewal label.
      return { dueDate: null, renewalDate };
    case "payment_due":
      return { dueDate: dueDate ?? (distinct.length === 1 ? distinct[0] : null), renewalDate: null };
    case "renewal_notice":
      return {
        dueDate: null,
        renewalDate: renewalDate ?? dueDate ?? (distinct.length >= 1 ? distinct[0] : null),
      };
    case "trial_ending":
      return { dueDate: dueDate ?? (distinct.length >= 1 ? distinct[0] : null), renewalDate };
    case "price_change":
      return { dueDate: null, renewalDate: renewalDate ?? (distinct.length >= 1 ? distinct[0] : null) };
    default:
      return { dueDate: null, renewalDate: null };
  }
}

// ---------- charge date ----------

const CHARGE_LABEL =
  /(order date|order placed( on)?|(?<!be )charged on|transaction date|date of purchase|purchase date)\W{0,3}$/i;

/** An explicitly labeled order/charge date ("Order date: Sep 3, 2026"), if the email states one. */
export function statedChargeDate(text: string, emailDate: string): string | null {
  for (const d of findDates(text, emailDate)) {
    if (CHARGE_LABEL.test(text.slice(Math.max(0, d.index - 40), d.index))) return d.iso;
  }
  return null;
}


// ---------- cadence ----------

// A generic "a/per/'/' <unit>" only counts right after a price ("$9.99 a month", "$15/mo",
// "12.99 USD per month"); on its own it matches prose like "at least a week prior to departure".
const PRICE = String.raw`(?:[$€£]\s?\d[\d,]*(?:\.\d{2})?(?:\s?(?:USD|EUR|GBP))?|\d[\d,]*(?:\.\d{2})?\s?(?:USD|EUR|GBP))`;
const perUnit = (unit: string) => String.raw`${PRICE}\s{0,2}(?:\/|\b(?:per|a)\b)\s{0,2}(?:${unit})\b`;

const STRONG: [Cadence, RegExp][] = [
  ["monthly", new RegExp(`(${perUnit("month|mo")}|billed monthly|monthly (plan|subscription|membership|charge)|every month)`, "i")],
  [
    "yearly",
    new RegExp(
      `(${perUnit("year|yr")}|billed (annually|yearly)|(annual|yearly|12-month)(?:\\s+[\\w+&'-]+){0,3}?\\s+(plan|subscription|membership|charge|renewal)|every 12 months|renews every year)`,
      "i"
    ),
  ],
  ["quarterly", new RegExp(`(${perUnit("quarter")}|quarterly|every 3 months)`, "i")],
  ["weekly", new RegExp(`(${perUnit("week|wk")}|billed weekly|weekly (plan|subscription|charge))`, "i")],
];

export function detectCadence(text: string): Cadence | null {
  let best: { c: Cadence; i: number } | null = null;
  for (const [c, re] of STRONG) {
    const m = re.exec(text);
    if (m && (!best || m.index < best.i)) best = { c, i: m.index };
  }
  return best?.c ?? null;
}

// ---------- cancel link ----------

const URL_RE = /https?:\/\/[^\s<>)\]"']+/g;

export function pickCancelUrl(
  email: RawEmail,
  senderDomain: string
): { url: string | null; trusted: boolean } {
  const candidates = [...email.links];
  for (const m of email.bodyText.matchAll(URL_RE)) {
    const ctx = email.bodyText.slice(Math.max(0, m.index! - 100), m.index!).toLowerCase();
    if (/cancel|manage (your )?(subscription|membership|plan)/.test(ctx)) {
      candidates.push({ href: m[0].replace(/[.,;:!?]+$/, ""), text: ctx.slice(-60) });
    }
  }

  let best: { url: string; trusted: boolean; score: number } | null = null;
  for (const l of candidates) {
    if (!/^https:\/\//i.test(l.href) || l.href.length > 2048) continue;
    const hay = `${l.text} ${l.href}`.toLowerCase();
    let score = 0;
    if (/cancel/.test(hay)) score += 10;
    if (/(manage|update|change|edit).{0,20}(subscription|membership|plan|billing|payment)|subscription settings|membership settings/.test(hay))
      score += 6;
    if (/(billing|subscriptions?|membership|account)/.test(l.href.toLowerCase())) score += 2;
    if (/(unsubscribe|opt[-_ ]?out|email[-_ ]?preferences|privacy|terms|help|support|faq)/.test(hay) && !/cancel/.test(hay))
      score -= 10;
    if (score < 6) continue;
    const trusted = isTrustedLink(l.href, senderDomain);
    if (!best || score > best.score || (score === best.score && trusted && !best.trusted)) {
      best = { url: l.href, trusted, score };
    }
  }
  return best ? { url: best.url, trusted: best.trusted } : { url: null, trusted: false };
}

// ---------- confidence ----------

const RELEVANT: EmailKind[] = ["receipt", "renewal_notice", "trial_ending", "payment_due", "price_change", "cancellation"];

export function isRelevantKind(kind: EmailKind): boolean {
  return RELEVANT.includes(kind);
}

export function hasBillingSignal(text: string): boolean {
  return BILLING_SIGNAL.test(text);
}

function scoreConfidence(args: {
  kind: EmailKind;
  source: "subject" | "body" | "none";
  amount: number | null;
  dueDate: string | null;
  renewalDate: string | null;
  merchantKnown: boolean;
  merchantPresent: boolean;
  cadence: Cadence | null;
}): number {
  const { kind, source, amount, dueDate, renewalDate } = args;
  if (kind === "marketing") return source === "subject" ? 0.8 : 0.5;
  if (kind === "other") return 0.5;

  let required: boolean[];
  switch (kind) {
    case "receipt": required = [amount !== null]; break;
    case "payment_due": required = [dueDate !== null, amount !== null]; break;
    case "renewal_notice": required = [renewalDate !== null || amount !== null]; break;
    case "trial_ending": required = [dueDate !== null]; break;
    case "price_change": required = [amount !== null]; break;
    default: required = [true];
  }
  const frac = required.filter(Boolean).length / required.length;
  let conf = source === "subject" ? 0.45 : 0.3;
  conf += 0.3 * frac;
  if (args.merchantKnown) conf += 0.1;
  if (args.merchantPresent) conf += 0.1;
  if (args.cadence) conf += 0.05;
  return Math.min(0.99, Math.round(conf * 100) / 100);
}

// ---------- entry point ----------

export function extractWithRules(email: RawEmail): ExtractedRecord {
  const text = `${email.subject}\n${email.bodyText}`;
  const merchant = resolveMerchant(email.from, email.subject, email.bodyText);

  // A sender claiming to be a known brand from a foreign domain is treated as phishing and dropped.
  if (merchant.spoofed) {
    return {
      emailId: email.id,
      emailDate: email.date,
      kind: "other",
      relevant: false,
      merchant: null,
      merchantKey: null,
      amount: null,
      currency: null,
      cadence: null,
      dueDate: null,
      renewalDate: null,
      cancelUrl: null,
      cancelUrlTrusted: false,
      confidence: 0.9,
      method: "rules",
    };
  }

  const { kind, source } = classify(email.subject, email.bodyText);
  const relevant = isRelevantKind(kind);

  const amountHit = relevant ? pickAmount(text) : null;
  const assigned = relevant
    ? assignDates(text, findDates(text, email.date), kind)
    : { dueDate: null, renewalDate: null };
  const stated = kind === "receipt" ? statedChargeDate(text, email.date) : null;
  const chargeDate = kind === "receipt" ? stated ?? email.date.slice(0, 10) : undefined;
  const { dueDate } = assigned;
  // "Charged on <date>" on a receipt is when it was paid, not the next renewal.
  const renewalDate = stated && assigned.renewalDate === stated ? null : assigned.renewalDate;
  const cadence = relevant ? detectCadence(text) : null;
  const cancel = relevant && kind !== "cancellation" ? pickCancelUrl(email, merchant.senderDomain) : { url: null, trusted: false };

  const confidence = scoreConfidence({
    kind,
    source,
    amount: amountHit?.amount ?? null,
    dueDate,
    renewalDate,
    merchantKnown: merchant.known,
    merchantPresent: !!merchant.merchant,
    cadence,
  });

  return {
    emailId: email.id,
    emailDate: email.date,
    kind,
    relevant,
    merchant: relevant ? merchant.merchant : null,
    merchantKey: relevant ? merchant.key : null,
    amount: amountHit?.amount ?? null,
    currency: amountHit?.currency ?? null,
    cadence,
    dueDate,
    renewalDate,
    ...(chargeDate ? { chargeDate } : {}),
    cancelUrl: cancel.url,
    cancelUrlTrusted: cancel.trusted,
    confidence,
    method: "rules",
  };
}
