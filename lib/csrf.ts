// State-changing routes accept only same-origin browser requests. This compares Origin with the
// Host header, while requestOrigin below prefers x-forwarded-host; on Vercel the two agree.
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function first(v: string | null): string | null {
  const s = v?.split(",")[0]?.trim();
  return s ? s : null;
}

/**
 * The origin the browser used, for redirects that must land where its cookies live. Built from
 * x-forwarded-host / x-forwarded-proto when a proxy sets them, else the Host header and the
 * request URL's protocol. `next start` builds req.url on localhost even when the browser used
 * 127.0.0.1, so req.url alone is not enough. Anything malformed falls back to req.url's origin.
 */
export function requestOrigin(headers: Headers, fallbackUrl: string): string {
  const fallback = new URL(fallbackUrl);
  // x-forwarded-host is trusted because the deploy target (Vercel) overwrites it. Behind other
  // proxies that pass it through from the client, set APP_URL instead.
  const host = first(headers.get("x-forwarded-host")) ?? first(headers.get("host"));
  // A hostname or bracketed IPv6 and an optional port, nothing else (no path or userinfo).
  if (!host || !/^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(:\d+)?$/i.test(host)) return fallback.origin;
  const forwarded = first(headers.get("x-forwarded-proto"));
  const proto = forwarded === "http" || forwarded === "https" ? `${forwarded}:` : fallback.protocol;
  // The regex admits ports like :99999 that URL rejects.
  try {
    return new URL(`${proto}//${host}`).origin;
  } catch {
    return fallback.origin;
  }
}
