import { google, type gmail_v1 } from "googleapis";
import { decrypt, encrypt } from "./crypto";
import { getKv, setKv } from "./db";
import { checkOwner, type SessionUser } from "./session";
import { extractLinks, htmlToText } from "./html";
import type { RawEmail } from "./types";

// Read-only. The app can never send, modify, label, or delete mail.
// openid, email and profile identify who signed in; they grant no mailbox access.
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const SCOPES = [GMAIL_SCOPE, "openid", "email", "profile"];

const TOKEN_KEY = "google_tokens";
const OWNER_KEY = "owner_email";

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

export function authUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
    include_granted_scopes: false,
  });
}

export type SignInResult = { ok: true; user: SessionUser } | { ok: false; reason: "not_owner" | "no_identity" | "no_gmail" };

/**
 * Exchanges the OAuth code, identifies the account from its verified ID token, and only then
 * stores Gmail tokens. A second Google account cannot replace the owner's Gmail connection.
 */
export async function signInWithCode(code: string): Promise<SignInResult> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) return { ok: false, reason: "no_identity" };
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
  const claims = ticket.getPayload();
  if (!claims?.email || claims.email_verified === false) return { ok: false, reason: "no_identity" };
  if (!checkOwner(getKv(OWNER_KEY) || null, claims.email)) return { ok: false, reason: "not_owner" };
  // Google's consent screen lets people untick individual scopes.
  if (!tokens.scope?.split(" ").includes(GMAIL_SCOPE)) return { ok: false, reason: "no_gmail" };

  const existing = loadTokens();
  // Google only returns a refresh token on first consent; keep the old one if this response lacks it.
  const merged = { ...tokens, refresh_token: tokens.refresh_token ?? existing?.refresh_token };
  setKv(TOKEN_KEY, encrypt(JSON.stringify(merged)));
  setKv(OWNER_KEY, claims.email.toLowerCase());
  return { ok: true, user: { email: claims.email, name: claims.name ?? claims.email.split("@")[0] } };
}

function loadTokens(): { refresh_token?: string | null; [k: string]: unknown } | null {
  const raw = getKv(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(decrypt(raw));
  } catch {
    return null;
  }
}

export function isConnected(): boolean {
  return !!loadTokens();
}

export async function disconnect(): Promise<void> {
  const t = loadTokens();
  if (t?.refresh_token) {
    try {
      await oauthClient().revokeToken(String(t.refresh_token));
    } catch {
      // Revocation is best effort; we still drop the local copy below.
    }
  }
  setKv(TOKEN_KEY, "");
  // Disconnecting releases the install, so a different account can connect next.
  setKv(OWNER_KEY, "");
}

function gmailClient(): gmail_v1.Gmail {
  const tokens = loadTokens();
  if (!tokens) throw new Error("Gmail is not connected");
  const client = oauthClient();
  client.setCredentials(tokens);
  client.on("tokens", (t) => {
    const merged = { ...tokens, ...t, refresh_token: t.refresh_token ?? tokens.refresh_token };
    setKv(TOKEN_KEY, encrypt(JSON.stringify(merged)));
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

export async function listIdsForQuery(q: string, max: number): Promise<string[]> {
  const gmail = gmailClient();
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

export async function listMessageIds(afterEpochSeconds: number | null, maxMessages = SYNC_MAX_MESSAGES): Promise<string[]> {
  return listIdsForQuery(syncQuery(afterEpochSeconds), maxMessages);
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

export async function fetchEmail(id: string): Promise<RawEmail | null> {
  const gmail = gmailClient();
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
