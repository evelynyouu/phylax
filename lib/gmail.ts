import { google, type gmail_v1 } from "googleapis";
import { decrypt, encrypt } from "./crypto";
import { getKv, setKv } from "./db";
import { extractLinks, htmlToText } from "./html";
import type { RawEmail } from "./types";

// Read-only. The app can never send, modify, label, or delete mail.
// openid, email and profile grant no mailbox access.
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const SCOPES = [GMAIL_SCOPE, "openid", "email", "profile"];

const TOKEN_KEY = "google_tokens";

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

export type GmailConnectResult = { ok: true } | { ok: false; reason: "no_gmail" };

/** Exchanges the OAuth code and stores the Gmail tokens. The caller has already checked who is signed in. */
export async function saveGmailTokens(code: string): Promise<GmailConnectResult> {
  const { tokens } = await oauthClient().getToken(code);
  // Google's consent screen lets people untick individual scopes.
  if (!tokens.scope?.split(" ").includes(GMAIL_SCOPE)) return { ok: false, reason: "no_gmail" };

  const existing = loadTokens();
  // Google only returns a refresh token on first consent; keep the old one if this response lacks it.
  const merged = { ...tokens, refresh_token: tokens.refresh_token ?? existing?.refresh_token };
  setKv(TOKEN_KEY, encrypt(JSON.stringify(merged)));
  return { ok: true };
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
