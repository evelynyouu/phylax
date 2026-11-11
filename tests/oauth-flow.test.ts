import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// End-to-end Connect Gmail flow through the real route handlers (/api/auth/google and
// /api/auth/callback) and the real lib/gmail.ts, lib/crypto.ts and lib/sync.ts. Only Google's
// HTTP endpoints are faked: the OAuth2 client's token exchange, ID token check and revoke are
// stubbed on its prototype, the auth URL is built by the real googleapis client, and global fetch
// throws so any call that slips through to the network fails the test. Signed-in state and the
// per-user store are faked the way tests/sync-route.test.ts and tests/account-routes.test.ts do.
// invalid_grant during sync (needsReconnect set, nothing deleted) is covered in tests/data.test.ts
// ("Google refuses the token") and not repeated here.

const h = vi.hoisted(() => ({
  user: null as { id: string; email: string; name: string } | null,
  stores: new Map<string, import("../lib/store/types").Store>(),
}));

vi.mock("@/lib/current-user", () => ({ getOptionalUser: async () => h.user }));
// connection() only marks the route as request-time, and needs Next's request scope.
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => {} }));
vi.mock("@/lib/store", () => ({
  storeFor: async (u: { id: string }) => {
    const s = h.stores.get(u.id);
    if (!s) throw new Error(`no store for ${u.id}`);
    return s;
  },
}));

import { google } from "googleapis";
import { NextRequest } from "next/server";
import { GET as callback } from "../app/api/auth/callback/route";
import { GET as start } from "../app/api/auth/google/route";
import { FIXTURE_EMAILS } from "../fixtures/emails";
import { GMAIL_SCOPE } from "../lib/gmail";
import { memoryStore } from "../lib/store/memory";
import type { Store } from "../lib/store/types";
import { runSync, type GmailLayer } from "../lib/sync";

const KEY = "5a".repeat(32);
const APP = "https://subwatch.example";
const env = process.env as Record<string, string | undefined>;
const saved = { key: env.TOKEN_ENC_KEY, id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET, app: env.APP_URL };

// What fake Google answers.
const g = {
  tokens: {} as Record<string, unknown>,
  email: "a@gmail.com" as string | undefined,
  revokeFails: false,
};
const OAuth2 = google.auth.OAuth2.prototype;
const getToken = vi.spyOn(OAuth2, "getToken").mockImplementation((async () => ({ tokens: g.tokens, res: null })) as unknown as typeof OAuth2.getToken);
const verifyIdToken = vi
  .spyOn(OAuth2, "verifyIdToken")
  .mockImplementation((async () => ({ getPayload: () => (g.email ? { email: g.email } : { sub: "123" }) })) as unknown as typeof OAuth2.verifyIdToken);
const revokeToken = vi.spyOn(OAuth2, "revokeToken").mockImplementation((async () => {
  if (g.revokeFails) throw new Error("network down");
  return { data: {} };
}) as unknown as typeof OAuth2.revokeToken);

beforeAll(() => {
  env.TOKEN_ENC_KEY = KEY;
  env.GOOGLE_CLIENT_ID = "client-id.apps.googleusercontent.com";
  env.GOOGLE_CLIENT_SECRET = "client-secret";
  env.APP_URL = APP;
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

const FULL_SCOPE = `${GMAIL_SCOPE} openid https://www.googleapis.com/auth/userinfo.email`;

let alice: Store;
let bob: Store;
beforeEach(() => {
  getToken.mockClear();
  verifyIdToken.mockClear();
  revokeToken.mockClear();
  g.tokens = { access_token: "ya29.alice-access", refresh_token: "1//alice-refresh", scope: FULL_SCOPE, id_token: "id.jwt.alice", token_type: "Bearer" };
  g.email = "a@gmail.com";
  g.revokeFails = false;
  alice = memoryStore("alice");
  bob = memoryStore("bob");
  h.stores = new Map([
    ["alice", alice],
    ["bob", bob],
  ]);
  h.user = { id: "alice", email: "alice@berkeley.edu", name: "Alice" };
});

function startReq(next = "app") {
  // `next start` builds req.url on localhost; the browser's host comes from the Host header.
  return new NextRequest(`http://localhost:3200/api/auth/google?next=${next}`, { headers: { host: "127.0.0.1:3200" } });
}

function callbackReq(params: Record<string, string>, cookies: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(`http://localhost:3200/api/auth/callback?${qs}`, { headers: { host: "127.0.0.1:3200", ...(cookie ? { cookie } : {}) } });
}

const location = (res: Response) => res.headers.get("location") ?? "";
const setCookies = (res: Response) => res.headers.getSetCookie();
/** True when the response tells the browser to drop the cookie. */
function clears(res: Response, name: string): boolean {
  return setCookies(res).some((c) => c.startsWith(`${name}=;`) && /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(c));
}

/** Independent AES-256-GCM decryption with TOKEN_ENC_KEY (iv.tag.ciphertext, base64), not lib/crypto. */
function decryptWithKey(payload: string, keyHex: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

/** Runs /api/auth/google, then hands Google's answer to /api/auth/callback with the cookies it set. */
async function connect(next = "app", answer: Record<string, string> = { code: "4/auth-code" }) {
  const s = await start(startReq(next));
  const state = new URL(location(s)).searchParams.get("state")!;
  const cookies: Record<string, string> = { oauth_state: state };
  const nextCookie = s.cookies.get("oauth_next")?.value;
  if (nextCookie) cookies.oauth_next = nextCookie;
  return callback(callbackReq({ state, ...answer }, cookies));
}

describe("GET /api/auth/google", () => {
  it("sends a signed-in user to Google's consent screen with the exact request Subwatch needs", async () => {
    const res = await start(startReq());
    expect(res.status).toBe(307);
    const url = new URL(location(res));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = url.searchParams;
    expect(p.get("response_type")).toBe("code");
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("client_id")).toBe("client-id.apps.googleusercontent.com");
    expect(p.get("redirect_uri")).toBe(`${APP}/api/auth/callback`);
    expect(p.get("scope")!.split(" ").sort()).toEqual(["email", GMAIL_SCOPE, "openid"].sort());
    expect(p.get("include_granted_scopes")).toBe("false");

    const state = p.get("state")!;
    expect(state).toMatch(/^[0-9a-f]{48}$/);
    const cookie = setCookies(res).find((c) => c.startsWith("oauth_state="))!;
    expect(cookie).toContain(`oauth_state=${state}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=600/);
    expect(res.cookies.get("oauth_next")?.value).toBe("app");
  });

  it("uses a fresh random state every time", async () => {
    const states = new Set<string>();
    for (let i = 0; i < 5; i++) states.add(new URL(location(await start(startReq()))).searchParams.get("state")!);
    expect(states.size).toBe(5);
  });

  it("sends a signed-out visitor to /signin without setting a state", async () => {
    h.user = null;
    const res = await start(startReq());
    expect(location(res)).toBe("http://127.0.0.1:3200/signin");
    expect(res.cookies.get("oauth_state")).toBeUndefined();
  });

  it("sends a signed-in user back with not_configured when GOOGLE_CLIENT_ID is missing", async () => {
    const id = env.GOOGLE_CLIENT_ID;
    delete env.GOOGLE_CLIENT_ID;
    try {
      expect(location(await start(startReq("app")))).toBe("http://127.0.0.1:3200/app?auth=not_configured");
      expect(location(await start(startReq("signup")))).toBe("http://127.0.0.1:3200/signup?step=2&auth=not_configured");
    } finally {
      env.GOOGLE_CLIENT_ID = id;
    }
  });
});

describe("GET /api/auth/callback failures", () => {
  const cases: { name: string; params: Record<string, string>; cookies: Record<string, string>; google?: () => void; reason: string; exchanges: boolean }[] = [
    { name: "state mismatch", params: { state: "b".repeat(48), code: "c" }, cookies: { oauth_state: "a".repeat(48) }, reason: "invalid_state", exchanges: false },
    { name: "missing state cookie", params: { state: "a".repeat(48), code: "c" }, cookies: {}, reason: "invalid_state", exchanges: false },
    { name: "missing code", params: { state: "a".repeat(48) }, cookies: { oauth_state: "a".repeat(48) }, reason: "invalid_state", exchanges: false },
    { name: "error=access_denied", params: { error: "access_denied", state: "a".repeat(48) }, cookies: { oauth_state: "a".repeat(48) }, reason: "denied", exchanges: false },
    {
      name: "gmail.readonly unticked",
      params: { state: "a".repeat(48), code: "c" },
      cookies: { oauth_state: "a".repeat(48) },
      google: () => (g.tokens = { ...g.tokens, scope: "openid https://www.googleapis.com/auth/userinfo.email" }),
      reason: "no_gmail",
      exchanges: true,
    },
    {
      name: "id_token without an email",
      params: { state: "a".repeat(48), code: "c" },
      cookies: { oauth_state: "a".repeat(48) },
      google: () => (g.email = undefined),
      reason: "no_identity",
      exchanges: true,
    },
    {
      name: "no id_token at all",
      params: { state: "a".repeat(48), code: "c" },
      cookies: { oauth_state: "a".repeat(48) },
      google: () => (g.tokens = { ...g.tokens, id_token: undefined }),
      reason: "no_identity",
      exchanges: true,
    },
  ];

  for (const c of cases) {
    for (const next of ["app", "signup"] as const) {
      it(`${c.name} (next=${next}): lands on the ${next} failure target with ${c.reason}, stores nothing, clears the state`, async () => {
        c.google?.();
        const res = await callback(callbackReq(c.params, { ...c.cookies, oauth_next: next }));
        const target = next === "signup" ? `/signup?step=2&auth=${c.reason}` : `/app?auth=${c.reason}`;
        expect(location(res)).toBe(`http://127.0.0.1:3200${target}`);
        expect(clears(res, "oauth_state")).toBe(true);
        expect(clears(res, "oauth_next")).toBe(true);
        expect(await alice.getGmail()).toBeNull();
        expect(await bob.getGmail()).toBeNull();
        expect(getToken).toHaveBeenCalledTimes(c.exchanges ? 1 : 0);
      });
    }
  }

  it("a signed-out callback goes to /signin and stores nothing", async () => {
    h.user = null;
    const res = await callback(callbackReq({ state: "a".repeat(48), code: "c" }, { oauth_state: "a".repeat(48) }));
    expect(location(res)).toBe("http://127.0.0.1:3200/signin");
    expect(clears(res, "oauth_state")).toBe(true);
    expect(getToken).not.toHaveBeenCalled();
  });
});

describe("happy path: connect, then sync", () => {
  const fixtures = FIXTURE_EMAILS.slice(0, 6);
  const fakeGmail = (calls: Store[]): GmailLayer => ({
    configured: () => true,
    listMessageIds: async (s) => {
      calls.push(s);
      return fixtures.map((e) => e.id);
    },
    fetchEmail: async (s, id) => {
      calls.push(s);
      return fixtures.find((e) => e.id === id) ?? null;
    },
  });

  it("stores an encrypted connection for the signed-in user only, then syncs only that user's records", async () => {
    const res = await connect("app");
    expect(location(res)).toBe("http://127.0.0.1:3200/app");
    expect(clears(res, "oauth_state")).toBe(true);
    expect(getToken).toHaveBeenCalledWith("4/auth-code");
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: "id.jwt.alice", audience: "client-id.apps.googleusercontent.com" });

    const conn = await alice.getGmail();
    expect(conn).toMatchObject({ gmailEmail: "a@gmail.com", lastSyncEpoch: null, needsReconnect: false });
    // Not plaintext: no token appears in the stored value.
    for (const secret of ["ya29.alice-access", "1//alice-refresh", "id.jwt.alice"]) expect(conn!.encTokens).not.toContain(secret);
    expect(conn!.encTokens).not.toContain("{");
    const tokens = JSON.parse(decryptWithKey(conn!.encTokens, KEY));
    expect(tokens).toMatchObject({ access_token: "ya29.alice-access", refresh_token: "1//alice-refresh", scope: FULL_SCOPE });
    // A different key cannot read it.
    expect(() => decryptWithKey(conn!.encTokens, "00".repeat(32))).toThrow();
    expect(await bob.getGmail()).toBeNull();

    const calls: Store[] = [];
    const result = await runSync(alice, undefined, fakeGmail(calls));
    expect(result).toMatchObject({ source: "gmail", listed: fixtures.length, processed: fixtures.length, errors: 0 });
    expect(result.relevant).toBeGreaterThan(0);
    expect(calls.every((s) => s === alice)).toBe(true);
    const saved = await alice.loadRecords();
    expect(saved.map((r) => r.emailId).sort()).toEqual(fixtures.map((e) => e.id).sort());
    // The saved records never hold the email's text.
    const body = fixtures.find((e) => e.bodyText.length > 40)!.bodyText;
    expect(JSON.stringify(saved)).not.toContain(body);
    expect((await alice.getGmail())!.lastSyncEpoch).toBeGreaterThan(0);

    expect(await bob.loadRecords()).toEqual([]);
    expect(await bob.getGmail()).toBeNull();
  });

  it("next=signup lands on sign-up step 3", async () => {
    expect(location(await connect("signup"))).toBe("http://127.0.0.1:3200/signup?step=3");
    expect(await alice.getGmail()).toMatchObject({ gmailEmail: "a@gmail.com" });
  });
});

describe("reconnecting", () => {
  async function connectedThenFlagged() {
    await connect("app");
    const c = (await alice.getGmail())!;
    await alice.setGmail({ ...c, lastSyncEpoch: 1_800_000_000, needsReconnect: true });
    revokeToken.mockClear();
  }

  it("the same address (any case) keeps the cursor, clears needsReconnect, keeps the refresh token and revokes nothing", async () => {
    await connectedThenFlagged();
    g.email = "A@Gmail.com";
    // Google sends no refresh token on a repeat consent.
    g.tokens = { access_token: "ya29.alice-2", scope: FULL_SCOPE, id_token: "id.jwt.alice2" };
    expect(location(await connect("app"))).toBe("http://127.0.0.1:3200/app");
    const c = (await alice.getGmail())!;
    expect(c).toMatchObject({ lastSyncEpoch: 1_800_000_000, needsReconnect: false });
    expect(JSON.parse(decryptWithKey(c.encTokens, KEY))).toMatchObject({ access_token: "ya29.alice-2", refresh_token: "1//alice-refresh" });
    expect(revokeToken).not.toHaveBeenCalled();
  });

  it("a different address resets the cursor and revokes the old mailbox's token", async () => {
    await connectedThenFlagged();
    g.email = "other@gmail.com";
    g.tokens = { access_token: "ya29.other", refresh_token: "1//other-refresh", scope: FULL_SCOPE, id_token: "id.jwt.other" };
    expect(location(await connect("app"))).toBe("http://127.0.0.1:3200/app");
    expect(revokeToken).toHaveBeenCalledWith("1//alice-refresh");
    const c = (await alice.getGmail())!;
    expect(c).toMatchObject({ gmailEmail: "other@gmail.com", lastSyncEpoch: null, needsReconnect: false });
    expect(JSON.parse(decryptWithKey(c.encTokens, KEY))).toMatchObject({ refresh_token: "1//other-refresh" });
  });

  it("a failed revoke of the old token does not block connecting the new address", async () => {
    await connectedThenFlagged();
    g.revokeFails = true;
    g.email = "other@gmail.com";
    g.tokens = { access_token: "ya29.other", refresh_token: "1//other-refresh", scope: FULL_SCOPE, id_token: "id.jwt.other" };
    expect(location(await connect("app"))).toBe("http://127.0.0.1:3200/app");
    expect(revokeToken).toHaveBeenCalledWith("1//alice-refresh");
    expect(await alice.getGmail()).toMatchObject({ gmailEmail: "other@gmail.com", lastSyncEpoch: null });
  });
});
