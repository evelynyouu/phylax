import { google, type gmail_v1 } from "googleapis";
import { decrypt, encrypt } from "./crypto";
import { extractLinks, htmlToText } from "./html";
import type { GmailConnection, Store } from "./store/types";
import type { RawEmail } from "./types";

// Read-only. The app can never send, modify, label, or delete mail.
// openid and email grant no mailbox access; they tell us which Gmail address was connected,
// which may differ from the Phylax account's email. profile (name and picture) is asked only
// when Google sign-up creates the Phylax account in the same step.
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const SCOPES = [GMAIL_SCOPE, "openid", "email"];
export const SIGNUP_SCOPES = [...SCOPES, "profile"];

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export function oauthClient() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set");
  return new google.auth.OAuth2(id, secret, `${appUrl()}/api/auth/callback`);
}

export function gmailConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function authUrl(state: string, scope: string[] = SCOPES): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope,
    state,
    include_granted_scopes: false,
  });
}

/** Google refused the stored refresh token (expired or revoked). The user has to reconnect. */
export class GmailReconnectError extends Error {
  constructor() {
    super("reconnect");
    this.name = "GmailReconnectError";
  }
}

/**
 * True for Google's invalid_grant: the refresh token expired (every 7 days while the OAuth app
 * is in Testing) or the user revoked access. Gaxios puts it on response.data.error; the message
 * carries it too.
 */
export function isInvalidGrant(e: unknown): boolean {
  if (e instanceof GmailReconnectError) return true;
  if (!e || typeof e !== "object") return false;
  const data = (e as { response?: { data?: unknown } }).response?.data;
  if (data && typeof data === "object" && (data as { error?: unknown }).error === "invalid_grant") return true;
  return e instanceof Error && /\binvalid_grant\b/.test(e.message);
}

type Tokens = { refresh_token?: string | null; [k: string]: unknown };

function readTokens(c: GmailConnection | null): Tokens | null {
  if (!c?.encTokens) return null;
  try {
    return JSON.parse(decrypt(c.encTokens));
  } catch (e) {
    // A missing or malformed key is a setup problem, not a broken connection.
    if (e instanceof Error && e.message.startsWith("TOKEN_ENC_KEY")) throw e;
    return null;
  }
}

// Read-modify-write of the connection row, one at a time per store, so a token refresh and
// the sync's cursor update never overwrite each other.
const writes = new WeakMap<Store, Promise<void>>();

function sameMailbox(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Updates the stored connection if it is still `gmailEmail`. Serialized per store. If the user
 * disconnected or connected a different Gmail meanwhile, the write is skipped, so mailbox A's
 * tokens or cursor never land on mailbox B's row.
 */
export function updateGmail(store: Store, gmailEmail: string, fn: (c: GmailConnection) => GmailConnection): Promise<void> {
  const next = (writes.get(store) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const c = await store.getGmail();
      if (c && sameMailbox(c.gmailEmail, gmailEmail)) await store.setGmail(fn(c));
    });
  writes.set(store, next);
  return next;
}

// One Gmail client per store object (a store lives for one request or one script run), so a
// sync does not re-read and decrypt the tokens for every message.
const clients = new WeakMap<Store, Promise<gmail_v1.Gmail>>();

export type GmailConnectResult = { ok: true; gmailEmail: string } | { ok: false; reason: "no_identity" | "no_gmail" };

type GoogleTokens = import("google-auth-library").Credentials;

/** What Google answered for one consent: the tokens, the raw ID token, and whether Gmail was granted. */
export interface GoogleGrant {
  tokens: GoogleTokens;
  idToken: string | null;
  /** The verified Google address, or null when Google sent no usable ID token. */
  gmailEmail: string | null;
  hasGmail: boolean;
}

/** Exchanges the OAuth code and verifies the ID token. Stores nothing. */
export async function exchangeGoogleCode(code: string): Promise<GoogleGrant> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  // Google's consent screen lets people untick individual scopes.
  const hasGmail = !!tokens.scope?.split(" ").includes(GMAIL_SCOPE);
  const idToken = tokens.id_token ?? null;
  let gmailEmail: string | null = null;
  if (idToken) {
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    gmailEmail = ticket.getPayload()?.email ?? null;
  }
  return { tokens, idToken, gmailEmail, hasGmail };
}

/**
 * Stores a granted Gmail connection for the store's user. The caller has already checked who is
 * signed in; the connection belongs to that Phylax user, whatever Gmail address they picked.
 */
export async function saveGmailGrant(grant: GoogleGrant, store: Store): Promise<GmailConnectResult> {
  if (!grant.hasGmail) return { ok: false, reason: "no_gmail" };
  const gmailEmail = grant.gmailEmail;
  if (!gmailEmail) return { ok: false, reason: "no_identity" };
  const { tokens } = grant;

  const existing = await store.getGmail();
  const same = !!existing && sameMailbox(existing.gmailEmail, gmailEmail);
  const old = same ? readTokens(existing) : null;
  // Switching to a different Gmail: drop the old mailbox's grant at Google, as disconnect does.
  if (existing && !same) await revokeBestEffort(existing);
  // Google only returns a refresh token on first consent; keep the old one if this response lacks it.
  // The ID token was only needed to read the Gmail address above; it is not kept.
  const kept = { ...tokens };
  delete kept.id_token;
  const merged = { ...kept, refresh_token: tokens.refresh_token ?? old?.refresh_token };
  await store.setGmail({
    gmailEmail,
    encTokens: encrypt(JSON.stringify(merged)),
    // Reconnecting the same Gmail keeps the cursor; a different Gmail rescans 13 months.
    lastSyncEpoch: same ? existing!.lastSyncEpoch : null,
    needsReconnect: false,
  });
  clients.delete(store);
  return { ok: true, gmailEmail };
}

/** Exchanges the OAuth code and stores the Gmail connection for the store's (signed-in) user. */
export async function connectGmailWithCode(code: string, store: Store): Promise<GmailConnectResult> {
  const grant = await exchangeGoogleCode(code);
  // Checked before the ID token, as before: an unticked Gmail box is the more useful message.
  if (!grant.hasGmail) return { ok: false, reason: "no_gmail" };
  return saveGmailGrant(grant, store);
}

export async function isConnected(store: Store): Promise<boolean> {
  return (await store.getGmail()) !== null;
}

/**
 * Revokes the connection's grant at Google. Best effort: a failed revoke never throws or blocks
 * the caller's next step, but it is reported (false) so the user can be told to remove the grant
 * at https://myaccount.google.com/permissions. True when revoked or there was nothing to revoke.
 */
export async function revokeBestEffort(c: GmailConnection | null): Promise<boolean> {
  // A missing TOKEN_ENC_KEY still throws here: that is a setup problem, not a failed revoke.
  if (!c) return true;
  const t = readTokens(c);
  // Revoking either token removes the whole grant. Tokens that no longer decrypt cannot be revoked.
  const token = t?.refresh_token ?? t?.access_token;
  if (!token) return false;
  try {
    await oauthClient().revokeToken(String(token));
    return true;
  } catch {
    // The caller still replaces or drops the stored copy.
    return false;
  }
}

/** Revokes Google's grant (best effort), then deletes the connection. Records stay. */
export async function disconnect(store: Store): Promise<{ revokeFailed: boolean }> {
  const revoked = await revokeBestEffort(await store.getGmail());
  await store.setGmail(null);
  clients.delete(store);
  return { revokeFailed: !revoked };
}

function gmailClient(store: Store): Promise<gmail_v1.Gmail> {
  let p = clients.get(store);
  if (!p) {
    p = makeClient(store);
    clients.set(store, p);
    p.catch(() => clients.delete(store));
  }
  return p;
}

async function makeClient(store: Store): Promise<gmail_v1.Gmail> {
  const conn = await store.getGmail();
  if (!conn) throw new Error("Gmail is not connected");
  let tokens = readTokens(conn);
  // Stored tokens that no longer decrypt are as good as revoked.
  if (!tokens) throw new GmailReconnectError();
  const client = oauthClient();
  client.setCredentials(tokens);
  client.on("tokens", (t) => {
    tokens = { ...tokens, ...t, refresh_token: t.refresh_token ?? tokens!.refresh_token };
    const enc = encrypt(JSON.stringify(tokens));
    updateGmail(store, conn.gmailEmail, (c) => ({ ...c, encTokens: enc })).catch(() => {
      // The refreshed access token still works for this run; the next run refreshes again.
    });
  });
  return google.gmail({ version: "v1", auth: client });
}

const BILLING_QUERY = [
  "-in:spam",
  "-in:trash",
  "(",
  'subject:(receipt OR invoice OR subscription OR renew OR renewal OR billing OR payment OR trial OR statement OR "your order" OR cancelled OR canceled OR "price change" OR "amount due" OR "bill is ready")',
  'OR "free trial" OR "will be charged" OR "will renew" OR "amount due" OR "payment due"',
  ")",
].join(" ");

/** The exact Gmail search sync uses. The eval export uses it too, so "in query" means what sync sees. */
export function syncQuery(afterEpochSeconds: number | null): string {
  return afterEpochSeconds ? `${BILLING_QUERY} after:${afterEpochSeconds}` : `${BILLING_QUERY} newer_than:400d`;
}

export async function listIdsForQuery(store: Store, q: string, max: number): Promise<string[]> {
  const gmail = await gmailClient(store);
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.messages.list({ userId: "me", q, maxResults: 100, pageToken });
    for (const m of res.data.messages ?? []) if (m.id) ids.push(m.id);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < max);
  return ids.slice(0, max);
}

/** Sync reads at most this many query matches per run, newest first. */
export const SYNC_MAX_MESSAGES = 1500;

export async function listMessageIds(store: Store, afterEpochSeconds: number | null, maxMessages = SYNC_MAX_MESSAGES): Promise<string[]> {
  return listIdsForQuery(store, syncQuery(afterEpochSeconds), maxMessages);
}

function walk(part: gmail_v1.Schema$MessagePart, out: { plain: string[]; html: string[] }) {
  const mime = part.mimeType ?? "";
  if (part.body?.data) {
    const text = Buffer.from(part.body.data, "base64url").toString("utf8");
    if (mime === "text/plain") out.plain.push(text);
    else if (mime === "text/html") out.html.push(text);
  }
  for (const p of part.parts ?? []) walk(p, out);
}

export async function fetchEmail(store: Store, id: string): Promise<RawEmail | null> {
  const gmail = await gmailClient(store);
  const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  const payload = res.data.payload;
  if (!payload) return null;

  const header = (name: string) =>
    payload.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
  const bodies = { plain: [] as string[], html: [] as string[] };
  walk(payload, bodies);

  const html = bodies.html.join("\n");
  const bodyText = (bodies.plain.join("\n").trim() || htmlToText(html)).slice(0, 20000);
  const ms = Number(res.data.internalDate ?? Date.now());

  return {
    id,
    from: header("From"),
    subject: header("Subject"),
    date: new Date(ms).toISOString(),
    bodyText,
    links: html ? extractLinks(html) : [],
  };
}
