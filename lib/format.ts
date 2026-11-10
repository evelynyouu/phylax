import type { Cadence } from "./types";

export function money(amount: number | null, currency = "USD"): string {
  if (amount === null) return "Amount unknown";
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** "Nov 14", or "Jan 15, 2027" when the year differs from refYear. Parsed as UTC so there is no timezone drift. */
export function shortDate(iso: string, refYear?: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  if (refYear !== undefined && y !== refYear) opts.year = "numeric";
  return new Intl.DateTimeFormat("en-US", opts).format(dt);
}

export function relDays(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n > 1) return `in ${n} days`;
  return `${-n} days ago`;
}

export function cadenceLabel(c: Cadence | null): string {
  switch (c) {
    case "weekly": return "weekly";
    case "monthly": return "monthly";
    case "quarterly": return "quarterly";
    case "yearly": return "yearly";
    default: return "";
  }
}

export function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}
