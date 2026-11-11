import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A fake Google OAuth client: the token exchange returns whatever the test sets.
const google = vi.hoisted(() => ({
  tokens: {} as Record<string, unknown>,
  email: "b@gmail.com",
  revoked: [] as string[],
  revokeFails: false,
}));

vi.mock("googleapis", () => {
  class OAuth2 {
    async getToken() {
      return { tokens: google.tokens };
    }
    async verifyIdToken() {
      return { getPayload: () => ({ email: google.email }) };
    }
    async revokeToken(t: string) {
      google.revoked.push(t);
      if (google.revokeFails) throw new Error("network down");
    }
  }
  return { google: { auth: { OAuth2 }, gmail: () => ({}) } };
});

import { encrypt } from "../lib/crypto";
import { connectGmailWithCode, disconnect } from "../lib/gmail";
import { memoryStore } from "../lib/store/memory";

const env = process.env as Record<string, string | undefined>;
const saved = { key: env.TOKEN_ENC_KEY, id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET };

beforeAll(() => {
  env.TOKEN_ENC_KEY = "c".repeat(64);
  env.GOOGLE_CLIENT_ID = "id";
  env.GOOGLE_CLIENT_SECRET = "secret";
});
afterAll(() => {
  for (const [k, v] of [["TOKEN_ENC_KEY", saved.key], ["GOOGLE_CLIENT_ID", saved.id], ["GOOGLE_CLIENT_SECRET", saved.secret]] as const) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
});

beforeEach(() => {
  google.tokens = { scope: "https://www.googleapis.com/auth/gmail.readonly openid email", id_token: "jwt", refresh_token: "rt-b" };
  google.email = "b@gmail.com";
  google.revoked = [];
  google.revokeFails = false;
});

async function connectedTo(gmailEmail: string, refreshToken: string) {
  const s = memoryStore(`u-${gmailEmail}`);
  await s.setGmail({ gmailEmail, encTokens: encrypt(JSON.stringify({ refresh_token: refreshToken })), lastSyncEpoch: 50, needsReconnect: false });
  return s;
}

describe("connecting a different Gmail", () => {
  it("revokes the old mailbox's grant before storing the new one", async () => {
    const s = await connectedTo("a@gmail.com", "rt-a");
    expect(await connectGmailWithCode("code", s)).toEqual({ ok: true, gmailEmail: "b@gmail.com" });
    expect(google.revoked).toEqual(["rt-a"]);
    expect(await s.getGmail()).toMatchObject({ gmailEmail: "b@gmail.com", lastSyncEpoch: null });
  });

  it("still connects when revoking the old grant fails", async () => {
    google.revokeFails = true;
    const s = await connectedTo("a@gmail.com", "rt-a");
    expect(await connectGmailWithCode("code", s)).toEqual({ ok: true, gmailEmail: "b@gmail.com" });
    expect(await s.getGmail()).toMatchObject({ gmailEmail: "b@gmail.com" });
  });

  it("does not revoke anything when reconnecting the same Gmail", async () => {
    google.email = "A@gmail.com";
    const s = await connectedTo("a@gmail.com", "rt-a");
    await connectGmailWithCode("code", s);
    expect(google.revoked).toEqual([]);
    expect(await s.getGmail()).toMatchObject({ lastSyncEpoch: 50 });
  });
});

describe("disconnect", () => {
  it("revokes, drops the connection and reports success", async () => {
    const s = await connectedTo("a@gmail.com", "rt-a");
    expect(await disconnect(s)).toEqual({ revokeFailed: false });
    expect(google.revoked).toEqual(["rt-a"]);
    expect(await s.getGmail()).toBeNull();
  });

  it("still drops the connection when Google's revoke fails, and reports it", async () => {
    google.revokeFails = true;
    const s = await connectedTo("a@gmail.com", "rt-a");
    expect(await disconnect(s)).toEqual({ revokeFailed: true });
    expect(await s.getGmail()).toBeNull();
  });

  it("has nothing to revoke when no Gmail is connected", async () => {
    expect(await disconnect(memoryStore("none"))).toEqual({ revokeFailed: false });
  });
});
