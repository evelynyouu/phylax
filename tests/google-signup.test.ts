import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// "Continue with Google" on sign-up: one Google screen creates the Phylax account and connects
// Gmail. /api/auth/google accepts a signed-out visitor for next=signup, and /api/auth/callback
// signs them in with Google's ID token (Supabase signInWithIdToken), then stores the Gmail
// connection for the new account. Google's endpoints and Supabase's auth are faked.

const h = vi.hoisted(() => ({
  user: null as { id: string; email: string; name: string } | null,
  stores: new Map<string, import("../lib/store/types").Store>(),
  signIn: { error: null as { message: string } | null, userId: "newbie" },
  idTokens: [] as string[],
}));

vi.mock("@/lib/current-user", () => ({ getOptionalUser: async () => h.user }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => {} }));
vi.mock("@/lib/store", () => ({
  storeFor: async (u: { id: string }) => h.stores.get(u.id)!,
}));
vi.mock("@/lib/supabase/config", () => ({ supabaseEnv: () => ({ url: "https://x.supabase.co", key: "anon" }) }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      signInWithIdToken: async ({ provider, token }: { provider: string; token: string }) => {
        expect(provider).toBe("google");
        h.idTokens.push(token);
        if (h.signIn.error) return { data: { user: null, session: null }, error: h.signIn.error };
        return { data: { user: { id: h.signIn.userId }, session: {} }, error: null };
      },
    },
  }),
}));
vi.mock("@/lib/store/supabase", () => ({
  supabaseStore: (_client: unknown, userId: string) => h.stores.get(userId)!,
}));

import { google } from "googleapis";
import { NextRequest } from "next/server";
import { GET as callback } from "../app/api/auth/callback/route";
import { GET as start } from "../app/api/auth/google/route";
import { GMAIL_SCOPE } from "../lib/gmail";
import { memoryStore } from "../lib/store/memory";
import type { Store } from "../lib/store/types";

const env = process.env as Record<string, string | undefined>;
const saved = { key: env.TOKEN_ENC_KEY, id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET, app: env.APP_URL };
const g = { tokens: {} as Record<string, unknown>, email: "new@gmail.com" };
const OAuth2 = google.auth.OAuth2.prototype;
vi.spyOn(OAuth2, "getToken").mockImplementation((async () => ({ tokens: g.tokens, res: null })) as unknown as typeof OAuth2.getToken);
vi.spyOn(OAuth2, "verifyIdToken").mockImplementation((async () => ({ getPayload: () => ({ email: g.email }) })) as unknown as typeof OAuth2.verifyIdToken);

beforeAll(() => {
  env.TOKEN_ENC_KEY = "5a".repeat(32);
  env.GOOGLE_CLIENT_ID = "client-id.apps.googleusercontent.com";
  env.GOOGLE_CLIENT_SECRET = "client-secret";
  env.APP_URL = "https://phylax.example";
  vi.stubGlobal("fetch", async (url: unknown) => {
    throw new Error(`network call in a test: ${String(url)}`);
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
  for (const [k, v] of [["TOKEN_ENC_KEY", saved.key], ["GOOGLE_CLIENT_ID", saved.id], ["GOOGLE_CLIENT_SECRET", saved.secret], ["APP_URL", saved.app]] as const) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
});

let newbie: Store;
beforeEach(() => {
  h.user = null;
  h.signIn = { error: null, userId: "newbie" };
  h.idTokens = [];
  g.tokens = { access_token: "ya29.new", refresh_token: "1//new", scope: `${GMAIL_SCOPE} openid email profile`, id_token: "id.jwt.new" };
  g.email = "new@gmail.com";
  newbie = memoryStore("newbie");
  h.stores = new Map([["newbie", newbie]]);
});

const HOST = { host: "127.0.0.1:3200" };
const location = (res: Response) => res.headers.get("location") ?? "";

async function signUpWithGoogle(answer: Record<string, string> = { code: "4/code" }) {
  const s = await start(new NextRequest("http://localhost:3200/api/auth/google?next=signup", { headers: HOST }));
  const state = new URL(location(s)).searchParams.get("state");
  expect(state).toBeTruthy();
  const cookie = `oauth_state=${state}; oauth_next=${s.cookies.get("oauth_next")?.value}`;
  const qs = new URLSearchParams({ state: state!, ...answer }).toString();
  return callback(new NextRequest(`http://localhost:3200/api/auth/callback?${qs}`, { headers: { ...HOST, cookie } }));
}

describe("sign up with Google in one step", () => {
  it("asks Google for the profile too, so the new account gets a name", async () => {
    const res = await start(new NextRequest("http://localhost:3200/api/auth/google?next=signup", { headers: HOST }));
    const scope = new URL(location(res)).searchParams.get("scope")!.split(" ");
    expect(scope).toEqual(expect.arrayContaining([GMAIL_SCOPE, "openid", "email", "profile"]));
  });

  it("a signed-out visitor starting from sign-up goes to Google, not /signin", async () => {
    const res = await start(new NextRequest("http://localhost:3200/api/auth/google?next=signup", { headers: HOST }));
    expect(new URL(location(res)).hostname).toBe("accounts.google.com");
    expect(res.cookies.get("oauth_next")?.value).toBe("signup");
  });

  it("a signed-out visitor starting from anywhere else still goes to /signin", async () => {
    const res = await start(new NextRequest("http://localhost:3200/api/auth/google?next=app", { headers: HOST }));
    expect(location(res)).toBe("http://127.0.0.1:3200/signin");
  });

  it("signs in with Google's ID token, connects Gmail to the new account, and lands on step 3", async () => {
    const res = await signUpWithGoogle();
    expect(h.idTokens).toEqual(["id.jwt.new"]);
    expect(location(res)).toBe("http://127.0.0.1:3200/signup?step=3");
    expect((await newbie.getGmail())?.gmailEmail).toBe("new@gmail.com");
  });

  it("when Supabase refuses the ID token, stores nothing and says sign-in failed on step 2", async () => {
    h.signIn.error = { message: "Unacceptable audience" };
    const res = await signUpWithGoogle();
    expect(location(res)).toBe("http://127.0.0.1:3200/signup?step=2&auth=signin_failed");
    expect(await newbie.getGmail()).toBeNull();
  });

  it("when the Gmail box was unticked, still signs in but asks for Gmail again on step 2", async () => {
    g.tokens = { ...g.tokens, scope: "openid email profile" };
    const res = await signUpWithGoogle();
    expect(h.idTokens).toEqual(["id.jwt.new"]);
    expect(location(res)).toBe("http://127.0.0.1:3200/signup?step=2&auth=no_gmail");
    expect(await newbie.getGmail()).toBeNull();
  });

  it("a bad state signs nobody in", async () => {
    const res = await callback(
      new NextRequest("http://localhost:3200/api/auth/callback?state=forged&code=4/code", { headers: { ...HOST, cookie: "oauth_state=real; oauth_next=signup" } }),
    );
    expect(location(res)).toBe("http://127.0.0.1:3200/signup?step=2&auth=invalid_state");
    expect(h.idTokens).toEqual([]);
  });

  it("a signed-out callback that did not start from sign-up still goes to /signin", async () => {
    const res = await callback(new NextRequest("http://localhost:3200/api/auth/callback?state=s&code=c", { headers: { ...HOST, cookie: "oauth_state=s; oauth_next=app" } }));
    expect(location(res)).toBe("http://127.0.0.1:3200/signin");
    expect(h.idTokens).toEqual([]);
  });
});
