// Server logging that never writes an error object. Google (gaxios) errors carry the request
// config, including the Authorization header; Supabase errors can carry query details. Only the
// message and a short code reach the log.

/** The error's message (capped), or a fixed line for non-Error values. */
export function errorMessage(e: unknown): string {
  const m = e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string" ? (e as { message: string }).message : "unknown error";
  return m.slice(0, 300);
}

/** A short code from the error: `code` (gaxios, Supabase, Node) or else an HTTP `status`. */
export function errorCode(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const { code, status } = e as { code?: unknown; status?: unknown };
  for (const v of [code, status]) {
    if (typeof v === "string" && /^[\w.-]{1,64}$/.test(v)) return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/** console.error(label, message[, code]); never the error object itself. */
export function logError(label: string, e: unknown): void {
  const code = errorCode(e);
  if (code) console.error(label, errorMessage(e), code);
  else console.error(label, errorMessage(e));
}
