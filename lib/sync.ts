import { FIXTURE_EMAILS } from "../fixtures/emails";
import { extractEmail } from "./extract";
import { fetchEmail, gmailConfigured, GmailReconnectError, isInvalidGrant, listMessageIds, updateGmail } from "./gmail";
import { errorCode, errorMessage, logError } from "./log";
import { processWide } from "./process-wide";
import { withRetry } from "./retry";
import { buildDashboard } from "./resolve";
import type { Store } from "./store/types";
import type { Dashboard, ExtractedRecord, RawEmail } from "./types";

export { GmailReconnectError } from "./gmail";

export type DataSource = "gmail" | "fixtures";


export interface SyncResult {
  source: DataSource;
  listed: number;
  processed: number;
  relevant: number;
  llmUsed: number;
  errors: number;
}

export interface SyncProgress {
  running: boolean;
  listed: number;
  checked: number; // already stored + newly processed, for progress
  processed: number;
  relevant: number;
  /** "reconnect" when Google refused the token; otherwise SYNC_FAILED_MESSAGE, never the raw error. */
  error: string | null;
}

/** The Gmail calls sync makes. Tests pass a fake; the app uses the real one. */
export interface GmailLayer {
  configured(): boolean;
  listMessageIds(store: Store, afterEpochSeconds: number | null): Promise<string[]>;
  fetchEmail(store: Store, id: string): Promise<RawEmail | null>;
}

const realGmail: GmailLayer = { configured: gmailConfigured, listMessageIds: (s, after) => listMessageIds(s, after), fetchEmail };

const IDLE: SyncProgress = { running: false, listed: 0, checked: 0, processed: 0, relevant: 0, error: null };

// Per server process (shared by pages and route handlers): the latest progress and the running
// sync, keyed by user id.
const progress = processWide("syncProgress", () => new Map<string, SyncProgress>());
const running = processWide("syncRunning", () => new Map<string, Promise<SyncResult>>());

export function syncProgress(userId: string): SyncProgress {
  return { ...(progress.get(userId) ?? IDLE) };
}

export class SyncAlreadyRunningError extends Error {
  constructor() {
    super("A sync is already running");
    this.name = "SyncAlreadyRunningError";
  }
}

/** What the browser sees when a sync fails for any reason but a refused token. */
export const SYNC_FAILED_MESSAGE = "Sync failed. Please try again.";

const CONCURRENCY = 3;

/**
 * What sync saves for an email. A non-billing record exists only so the next sync does not
 * fetch that email again, so it keeps the id, date, kind, method and confidence and nothing
 * the email said (no merchant, amount, dates or link). Billing records are kept whole.
 */
export function recordToSave(rec: ExtractedRecord): ExtractedRecord {
  if (rec.relevant) return rec;
  return {
    emailId: rec.emailId,
    emailDate: rec.emailDate,
    kind: rec.kind,
    relevant: false,
    merchant: null,
    merchantKey: null,
    amount: null,
    currency: null,
    cadence: null,
    dueDate: null,
    renewalDate: null,
    cancelUrl: null,
    cancelUrlTrusted: false,
    confidence: rec.confidence,
    method: rec.method,
  };
}

export async function inBatches<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/** One sync per user at a time; a second call while one runs rejects with SyncAlreadyRunningError. */
export interface SyncOptions {
  /** Backoff delay between retries; tests inject an instant one. */
  sleep?: (ms: number) => Promise<void>;
  /** Tests only: read the sample emails in fixtures/ instead of Gmail. The app always reads Gmail. */
  source?: DataSource;
}

export async function runSync(
  store: Store,
  onProgress?: (p: SyncProgress) => void,
  gmail: GmailLayer = realGmail,
  opts: SyncOptions = {},
): Promise<SyncResult> {
  const id = store.userId;
  if (running.has(id)) throw new SyncAlreadyRunningError();
  const job = runTracked(store, onProgress, gmail, opts);
  running.set(id, job);
  try {
    return await job;
  } finally {
    running.delete(id);
  }
}

async function runTracked(store: Store, onProgress: ((p: SyncProgress) => void) | undefined, gmail: GmailLayer, opts: SyncOptions): Promise<SyncResult> {
  const id = store.userId;
  progress.set(id, { running: true, listed: 0, checked: 0, processed: 0, relevant: 0, error: null });
  let skipped = 0;
  const report = (result: SyncResult) => {
    progress.set(id, {
      ...syncProgress(id),
      listed: result.listed,
      checked: skipped + result.processed + result.errors,
      processed: result.processed,
      relevant: result.relevant,
    });
    onProgress?.(syncProgress(id));
  };
  const skip = (n: number) => (skipped += n);
  try {
    const result = await syncInner(store, gmail, report, skip, opts);
    progress.set(id, { ...syncProgress(id), running: false });
    return result;
  } catch (e) {
    const error = e instanceof GmailReconnectError ? "reconnect" : SYNC_FAILED_MESSAGE;
    progress.set(id, { ...syncProgress(id), running: false, error });
    throw e;
  }
}

async function syncInner(
  store: Store,
  gmail: GmailLayer,
  report: (r: SyncResult) => void,
  skip: (n: number) => void,
  opts: SyncOptions,
): Promise<SyncResult> {
  const source = opts.source ?? "gmail";
  const result: SyncResult = { source, listed: 0, processed: 0, relevant: 0, llmUsed: 0, errors: 0 };
  const keep = async (email: RawEmail) => {
    // Rules only: the AI fallback is a local eval tool and is never on for users (lib/extract).
    const rec = await extractEmail(email);
    await store.saveRecord(recordToSave(rec));
    result.processed++;
    if (rec.relevant) result.relevant++;
    if (rec.method === "llm") result.llmUsed++;
    report(result);
  };

  if (source === "fixtures") {
    result.listed = FIXTURE_EMAILS.length;
    report(result);
    const known = await store.knownIds(FIXTURE_EMAILS.map((e) => e.id));
    for (const email of FIXTURE_EMAILS) {
      if (known.has(email.id)) {
        skip(1);
        report(result);
        continue;
      }
      await keep(email);
    }
    return result;
  }

  if (!gmail.configured()) throw new Error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
  const conn = await store.getGmail();
  if (!conn) throw new Error("Gmail is not connected");

  // Google refused the token: keep the connection row and every record, flag it, and stop.
  // Writes name this sync's mailbox, so they skip a different Gmail connected meanwhile.
  const needReconnect = async (): Promise<never> => {
    await updateGmail(store, conn.gmailEmail, (c) => ({ ...c, needsReconnect: true }));
    throw new GmailReconnectError();
  };

  const startedAt = Math.floor(Date.now() / 1000);
  // One day of overlap so a message that arrives mid-sync is not missed. Dedup is by message id.
  const after = conn.lastSyncEpoch ? Math.max(0, conn.lastSyncEpoch - 86400) : null;
  let ids: string[];
  try {
    ids = await gmail.listMessageIds(store, after);
  } catch (e) {
    if (isInvalidGrant(e)) return needReconnect();
    throw e;
  }
  result.listed = ids.length;
  const known = await store.knownIds(ids);
  const fresh = ids.filter((id) => !known.has(id));
  skip(ids.length - fresh.length);
  report(result);

  let revoked = false;
  const seenReasons = new Set<string>();
  for (let i = 0; i < fresh.length && !revoked; i += CONCURRENCY) {
    await Promise.all(
      fresh.slice(i, i + CONCURRENCY).map(async (id) => {
        try {
          await withRetry(async () => {
            const email = await gmail.fetchEmail(store, id);
            if (email) await keep(email);
          }, opts.sleep);
        } catch (e) {
          // A dead token is one problem, not one error per message.
          if (isInvalidGrant(e)) revoked = true;
          else {
            // Each distinct reason is logged once per run: message and code only, no ids or content.
            const reason = `${errorCode(e) ?? ""}|${errorMessage(e)}`;
            if (!seenReasons.has(reason)) {
              seenReasons.add(reason);
              logError("sync: message failed", e);
            }
            result.errors++;
            report(result);
          }
        }
      }),
    );
  }
  if (revoked) return needReconnect();
  if (result.errors > 0) logError("sync:", { message: `sync finished with ${result.errors} failed messages` });

  // Only advance the cursor on a clean run so failed messages are retried next time.
  await updateGmail(store, conn.gmailEmail, (c) => ({
    ...c,
    needsReconnect: false,
    lastSyncEpoch: result.errors === 0 ? startedAt : c.lastSyncEpoch,
  }));
  return result;
}

/** When the last successful Gmail sync finished, as an ISO time, or null. */
export async function lastSyncedAt(store: Store): Promise<string | null> {
  const v = (await store.getGmail())?.lastSyncEpoch;
  return v ? new Date(v * 1000).toISOString() : null;
}

export async function getDashboard(
  store: Store,
): Promise<{ dashboard: Dashboard; connected: boolean; reconnect: boolean }> {
  const [records, dismissed, manualCancels, paid, reminders, conn, edits] = await Promise.all([
    store.loadRecords(),
    store.marks("dismissed"),
    store.marks("manual_cancels"),
    store.marks("paid"),
    store.marks("reminders"),
    store.getGmail(),
    // Edits are optional: if their table is missing (migration not applied yet) the dashboard still works.
    store.listEdits().catch((e) => {
      logError("dashboard: could not load subscription edits", e);
      return [];
    }),
  ]);
  const dashboard = buildDashboard(records, {
    dismissed: new Set(dismissed.keys()),
    manualCancels,
    paid: new Set(paid.keys()),
    reminders: new Set(reminders.keys()),
    edits,
  });
  return { dashboard, connected: conn !== null, reconnect: conn?.needsReconnect === true };
}
