import { afterEach, describe, expect, it, vi } from "vitest";

const env = process.env as Record<string, string | undefined>;
const saved = { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, app: env.APP_URL };
afterEach(() => {
  for (const [k, v] of [["NEXT_PUBLIC_SUPABASE_URL", saved.url], ["NEXT_PUBLIC_SUPABASE_ANON_KEY", saved.key], ["APP_URL", saved.app]] as const) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
});

vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ auth: { signOut: async () => ({}) } }) }));

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
