import { findDates } from "../extract/dates";
import type { EmailKind, EmailLink, RawEmail } from "../types";
import type { CorpusEntry, Labels } from "./types";

// Pure helpers for the labeling CLI. Candidates come from the raw email text, never from the
// extractor, so the labeler is not shown what the app would pick.

export interface Candidates {
  amounts: number[];
  dates: string[];
  links: EmailLink[];
}

export type Parsed<T> = { ok: true; value: T | null } | { ok: false; error: string };

export const KIND_ORDER: EmailKind[] = [
  "receipt",
  "renewal_notice",
  "trial_ending",
  "payment_due",
  "price_change",
  "cancellation",
  "marketing",
  "other",
];

// The alternation keeps "$1234.00" from matching as "$123".
const AMOUNT_RE = /[$€£]\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?/g;

function toNumber(s: string): number {
  return Number(s.replace(/[$€£,\s]/g, ""));
}

export function candidates(email: RawEmail): Candidates {
  const text = `${email.subject}\n${email.bodyText}`;
  const amounts = [...new Set((text.match(AMOUNT_RE) ?? []).map(toNumber))];
  const dates = [...new Set(findDates(text, email.date).map((d) => d.iso))];
  const links = email.links.filter((l) => l.href.startsWith("https:"));
  return { amounts, dates, links };
}

const EMPTY = { ok: false as const, error: "Enter a value, or - for none." };

function pick<T>(input: string, prefix: string, list: T[]): Parsed<T> | null {
  const m = new RegExp(`^${prefix}(\\d+)$`).exec(input);
  if (!m) return null;
  const i = Number(m[1]) - 1;
  if (i < 0 || i >= list.length) return { ok: false, error: `No ${prefix}${m[1]}; choose ${prefix}1 to ${prefix}${list.length}.` };
  return { ok: true, value: list[i] };
}

export function parseKind(input: string): Parsed<EmailKind> {
  const s = input.trim();
  if (!s) return EMPTY;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > KIND_ORDER.length) return { ok: false, error: "Choose 1 to 8." };
  return { ok: true, value: KIND_ORDER[n - 1] };
}

export function parseAmount(input: string, c: Candidates): Parsed<number> {
  const s = input.trim();
  if (!s) return EMPTY;
  if (s === "-") return { ok: true, value: null };
  const picked = pick(s, "a", c.amounts);
  if (picked) return picked;
  if (!/^[$€£]?\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(s)) {
    return { ok: false, error: "Use a1, a2, ..., a number like 12.50, or -." };
  }
  return { ok: true, value: toNumber(s) };
}

function validIso(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function parseDate(input: string, c: Candidates): Parsed<string> {
  const s = input.trim();
  if (!s) return EMPTY;
  if (s === "-") return { ok: true, value: null };
  const picked = pick(s, "d", c.dates);
  if (picked) return picked;
  if (!validIso(s)) return { ok: false, error: "Use d1, d2, ..., a real date as YYYY-MM-DD, or -." };
  return { ok: true, value: s };
}

/** Only links that are in the email can be chosen, so a typo cannot invent a URL. */
export function parseLink(input: string, c: Candidates): Parsed<string> {
  const s = input.trim();
  if (!s) return EMPTY;
  if (s === "-") return { ok: true, value: null };
  const picked = pick(s, "l", c.links);
  if (picked) return picked.ok ? { ok: true, value: picked.value?.href ?? null } : picked;
  return { ok: false, error: "Use l1, l2, ..., or -." };
}

export function nextUnlabeled(entries: CorpusEntry[], labels: Labels): number {
  return entries.findIndex((e) => labels[e.email.id] === undefined);
}
