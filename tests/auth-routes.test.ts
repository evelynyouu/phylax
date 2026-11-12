import { afterEach, describe, expect, it, vi } from "vitest";

const env = process.env as Record<string, string | undefined>;
const saved = { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, app: env.APP_URL };
afterEach(() => {
  for (const [k, v] of [["NEXT_PUBLIC_SUPABASE_URL", saved.url], ["NEXT_PUBLIC_SUPABASE_ANON_KEY", saved.key], ["APP_URL", saved.app]] as const) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
});

const s = vi.hoisted(() => ({ exchangeError: null as null | { message: string } }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { signOut: async () => ({}), exchangeCodeForSession: async () => ({ error: s.exchangeError }) } }),
}));

import { NextRequest } from "next/server";
import { GET as authCallback } from "../app/auth/callback/route";
import { POST as signout } from "../app/api/auth/signout/route";

describe("auth redirects stay on the browser's host", () => {
  it("/auth/callback redirects to the Host header's origin, not the localhost URL next start builds", async () => {
    delete env.NEXT_PUBLIC_SUPABASE_URL;
    delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await authCallback(new NextRequest("http://localhost:3200/auth/callback?next=https://evil.example", { headers: { host: "127.0.0.1:3200" } }));
    expect(res.headers.get("location")).toBe("http://127.0.0.1:3200/signin?auth=accounts_not_configured");
  });

  it("/auth/callback without a code lands on Settings or the whitelisted next, never on a sign-in error", async () => {
    env.NEXT_PUBLIC_SUPABASE_URL = "http://x.test";
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "k";
    const loc = async (q: string) => (await authCallback(new NextRequest(`http://localhost:3200/auth/callback?${q}`, { headers: { host: "localhost:3200" } }))).headers.get("location");
    const res = await authCallback(new NextRequest("http://localhost:3200/auth/callback?next=/app/settings&message=Confirmation+link+accepted", { headers: { host: "localhost:3200" } }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3200/app/settings?email=pending");
    expect(await loc("next=/app/settings")).toBe("http://localhost:3200/app/settings?email=changed");
    expect(await loc("next=/app")).toBe("http://localhost:3200/app");
    expect(await loc("next=https://evil.example")).toBe("http://localhost:3200/app");
    expect(await loc("error=access_denied&next=/app/settings")).toBe("http://localhost:3200/signin?auth=denied");
  });

  it("/auth/callback with a code says the email changed on Settings, and sends a failed Settings exchange back to Settings", async () => {
    env.NEXT_PUBLIC_SUPABASE_URL = "http://x.test";
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "k";
    const loc = async (q: string) => (await authCallback(new NextRequest(`http://localhost:3200/auth/callback?${q}`, { headers: { host: "localhost:3200" } }))).headers.get("location");
    s.exchangeError = null;
    expect(await loc("code=abc&next=/app/settings")).toBe("http://localhost:3200/app/settings?email=changed");
    expect(await loc("code=abc&next=/app")).toBe("http://localhost:3200/app");
    s.exchangeError = { message: "invalid flow state" };
    // Opened on another device: no code verifier here, but the email may already be changed.
    expect(await loc("code=abc&next=/app/settings")).toBe("http://localhost:3200/app/settings?email=check");
    expect(await loc("code=abc&next=/app")).toBe("http://localhost:3200/signin?auth=failed");
    expect(await loc("code=abc")).toBe("http://localhost:3200/signin?auth=failed");
    s.exchangeError = null;
  });

  it("sign-out lands on the browser's host when APP_URL is unset", async () => {
    delete env.APP_URL;
    delete env.NEXT_PUBLIC_SUPABASE_URL;
    const res = await signout(
      new Request("http://localhost:3200/api/auth/signout", { method: "POST", headers: { host: "127.0.0.1:3200", origin: "http://127.0.0.1:3200" } }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://127.0.0.1:3200/signin?auth=signed_out");
  });
});
