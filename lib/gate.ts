// Pure routing decision for proxy.ts, kept separate so it can be tested without Next.

const PUBLIC_API = new Set(["/api/auth/google", "/api/auth/callback", "/api/auth/signout"]);

export type GateResult = "next" | "signin" | "unauthorized";

export function gate({ path, signedIn }: { path: string; method: string; signedIn: boolean }): GateResult {
  if (signedIn) return "next";
  if (path === "/app" || path.startsWith("/app/") || path === "/connect-gmail") return "signin";
  if (path.startsWith("/api/") && !PUBLIC_API.has(path)) return "unauthorized";
  return "next";
}
