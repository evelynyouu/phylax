// Date parsing for email text. Handles the formats billing emails actually use.

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const MON =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

export interface FoundDate {
  iso: string; // YYYY-MM-DD
  index: number;
  end: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function validIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** When the year is missing, pick the nearest sensible year relative to the email date. */
function inferYear(m: number, d: number, ref: Date): number {
  const y = ref.getUTCFullYear();
  const candidate = Date.UTC(y, m - 1, d);
  const cutoff = ref.getTime() - 45 * 86400000;
  return candidate < cutoff ? y + 1 : y;
}

function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

export function findDates(text: string, emailDateIso: string): FoundDate[] {
  const ref = new Date(emailDateIso);
  const out: FoundDate[] = [];
  const seen = new Set<number>();

  const push = (iso: string | null, index: number, end: number) => {
    if (!iso) return;
    // Skip overlapping matches (a longer pattern already claimed this span).
    for (let i = index; i < end; i++) if (seen.has(i)) return;
    for (let i = index; i < end; i++) seen.add(i);
    out.push({ iso, index, end });
  };

  // 2026-11-14
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    push(validIso(+m[1], +m[2], +m[3]), m.index!, m.index! + m[0].length);
  }
  // Nov 14, 2026 | November 14 | Nov. 14th, 2026
  const mdy = new RegExp(`\\b${MON}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "gi");
  for (const m of text.matchAll(mdy)) {
    const mon = MONTHS[m[1].toLowerCase()];
    const day = +m[2];
    const year = m[3] ? +m[3] : inferYear(mon, day, ref);
    push(validIso(year, mon, day), m.index!, m.index! + m[0].length);
  }
  // 14 Nov 2026 | 14th November
  const dmy = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON}\\.?(?:,?\\s+(\\d{4}))?\\b`, "gi");
  for (const m of text.matchAll(dmy)) {
    const mon = MONTHS[m[2].toLowerCase()];
    const day = +m[1];
    const year = m[3] ? +m[3] : inferYear(mon, day, ref);
    push(validIso(year, mon, day), m.index!, m.index! + m[0].length);
  }
  // 11/14/2026 or 11/14/26 (US order)
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g)) {
    push(validIso(fullYear(+m[3]), +m[1], +m[2]), m.index!, m.index! + m[0].length);
  }

  return out.sort((a, b) => a.index - b.index);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  // Clamp the day so Jan 31 + 1 month becomes Feb 28, not Mar 3.
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(d, lastDay))}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso.slice(0, 10) + "T00:00:00Z");
  const b = Date.parse(toIso.slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
