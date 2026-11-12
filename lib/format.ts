import type { Cadence } from "./types";

export function money(amount: number | null, currency = "USD"): string {
  if (amount === null) return "Amount unknown";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
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
    case "semiannual": return "every 6 months";
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

/** "just now", "4 minutes ago", "3 hours ago", "2 days ago". */
export function ago(iso: string, now: number = Date.now()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** "Monday, November 9" for a YYYY-MM-DD date. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}
