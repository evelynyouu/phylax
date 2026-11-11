// Retry helper for transient Gmail and network failures during sync.

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);
const TRANSIENT_NET = new Set(["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNREFUSED"]);
const RATE_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded"]);

function reasons(e: object): string[] {
  const out: string[] = [];
  const pick = (v: unknown) => {
    if (!Array.isArray(v)) return;
    for (const x of v) if (x && typeof x === "object" && typeof (x as { reason?: unknown }).reason === "string") out.push((x as { reason: string }).reason);
  };
  const o = e as { errors?: unknown; response?: { data?: { error?: { errors?: unknown } } } };
  pick(o.errors);
  pick(o.response?.data?.error?.errors);
  return out;
}

function messages(e: object): string[] {
  const o = e as { message?: unknown; response?: { data?: { error?: { message?: unknown } } } };
  return [o.message, o.response?.data?.error?.message].filter((m): m is string => typeof m === "string");
}

function statusOf(e: unknown): number | undefined {
  if (!e || typeof e !== "object") return undefined;
  const o = e as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  const nums = [o.code, o.status, o.response?.status].map((v) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v));
  return nums.find((v): v is number => typeof v === "number");
}

function isQuotaError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const status = statusOf(e);
  if (status === 429) return true;
  if (status !== 403) return false;
  return reasons(e).some((r) => RATE_REASONS.has(r)) || messages(e).some((m) => m.includes("Quota exceeded"));
}

/** True for failures worth retrying: rate limits, 5xx and network resets. Never invalid_grant or other 4xx. */
export function isTransientError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const o = e as { code?: unknown; status?: unknown; response?: { status?: unknown; data?: { error?: unknown } } };
  if (o.response?.data?.error === "invalid_grant") return false;
  const status = statusOf(e);
  if (status !== undefined) {
    if (TRANSIENT_STATUS.has(status)) return true;
    if (status === 403) return isQuotaError(e);
  }
  return typeof o.code === "string" && TRANSIENT_NET.has(o.code);
}

export const RETRY_DELAYS_MS = [500, 1000, 2000];

export const QUOTA_DELAYS_MS = [5000, 20000, 60000];
const MAX_RETRY_AFTER_MS = 60000;

/** Backoff for the given zero-based attempt: Retry-After if present (capped), longer for quota/rate limits. */
export function retryDelay(e: unknown, attempt: number): number {
  const h = (e as { response?: { headers?: Record<string, unknown> } } | null)?.response?.headers;
  const ra = Number(h?.["retry-after"]);
  if (h?.["retry-after"] !== undefined && h["retry-after"] !== "" && Number.isFinite(ra) && ra >= 0) return Math.min(ra * 1000, MAX_RETRY_AFTER_MS);
  const table = isQuotaError(e) ? QUOTA_DELAYS_MS : RETRY_DELAYS_MS;
  return table[Math.min(attempt, table.length - 1)];
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Runs fn, retrying transient errors up to 3 times with exponential backoff. Rethrows the last error. */
export async function withRetry<T>(fn: () => Promise<T>, sleep: (ms: number) => Promise<void> = realSleep): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= RETRY_DELAYS_MS.length || !isTransientError(e)) throw e;
      await sleep(retryDelay(e, attempt));
    }
  }
}
