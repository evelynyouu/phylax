import { FIXTURE_EMAILS } from "../fixtures/emails";
import { dismissedKeys, getKv, hasRecord, loadRecords, manualCancels, paidKeys, reminderKeys, saveRecord, setKv } from "./db";
import { extractEmail } from "./extract";
import { fetchEmail, gmailConfigured, isConnected, listMessageIds } from "./gmail";
import { buildDashboard } from "./resolve";
import type { Dashboard } from "./types";

export type DataSource = "gmail" | "fixtures";

export function dataSource(): DataSource {
  return process.env.DATA_SOURCE === "fixtures" ? "fixtures" : "gmail";
}

export interface SyncResult {
  source: DataSource;
  listed: number;
  processed: number;
  relevant: number;
  llmUsed: number;
  errors: number;
}

const LAST_SYNC = "last_sync_epoch";

export interface SyncProgress {
  running: boolean;
  listed: number;
  checked: number; // already stored + newly processed, for progress
  processed: number;
  relevant: number;
  error: string | null;
}

// One sync at a time per server process (the app is single-user and local).
let progress: SyncProgress = { running: false, listed: 0, checked: 0, processed: 0, relevant: 0, error: null };
let skipped = 0;

export function syncProgress(): SyncProgress {
  return { ...progress };
}
const CONCURRENCY = 5;

export async function inBatches<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

export async function runSync(onProgress?: (p: SyncProgress) => void): Promise<SyncResult> {
  progress = { running: true, listed: 0, checked: 0, processed: 0, relevant: 0, error: null };
  skipped = 0;
  try {
    const result = await runSyncInner(onProgress);
    progress = { ...progress, running: false };
    return result;
  } catch (e) {
    progress = { ...progress, running: false, error: e instanceof Error ? e.message : "Sync failed" };
    throw e;
  }
}

function report(result: SyncResult, onProgress?: (p: SyncProgress) => void) {
  progress = {
    ...progress,
    listed: result.listed,
    checked: skipped + result.processed + result.errors,
    processed: result.processed,
    relevant: result.relevant,
  };
  onProgress?.(syncProgress());
}

async function runSyncInner(onProgress?: (p: SyncProgress) => void): Promise<SyncResult> {
  const source = dataSource();
  const result: SyncResult = { source, listed: 0, processed: 0, relevant: 0, llmUsed: 0, errors: 0 };

  if (source === "fixtures") {
    result.listed = FIXTURE_EMAILS.length;
    report(result, onProgress);
    for (const email of FIXTURE_EMAILS) {
      if (hasRecord(email.id)) {
        skipped++;
        report(result, onProgress);
        continue;
      }
      const rec = await extractEmail(email);
      saveRecord(rec);
      result.processed++;
      if (rec.relevant) result.relevant++;
      if (rec.method === "llm") result.llmUsed++;
      report(result, onProgress);
    }
    return result;
  }

  if (!gmailConfigured()) throw new Error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or use DATA_SOURCE=fixtures");
  if (!isConnected()) throw new Error("Gmail is not connected");

  const startedAt = Math.floor(Date.now() / 1000);
  const last = getKv(LAST_SYNC);
  // One day of overlap so a message that arrives mid-sync is not missed. Dedup is by message id.
  const after = last ? Math.max(0, Number(last) - 86400) : null;
  const ids = await listMessageIds(after);
  result.listed = ids.length;
  const fresh = ids.filter((id) => !hasRecord(id));
  skipped = ids.length - fresh.length;
  report(result, onProgress);

  await inBatches(fresh, CONCURRENCY, async (id) => {
    try {
      const email = await fetchEmail(id);
      if (!email) return;
      const rec = await extractEmail(email);
      saveRecord(rec);
      result.processed++;
      if (rec.relevant) result.relevant++;
      if (rec.method === "llm") result.llmUsed++;
      report(result, onProgress);
    } catch {
      result.errors++;
      report(result, onProgress);
    }
  });

  // Only advance the cursor on a clean run so failed messages are retried next time.
  if (result.errors === 0) setKv(LAST_SYNC, String(startedAt));
  return result;
}

/** When the last successful Gmail sync finished, as an ISO time, or null. */
export function lastSyncedAt(): string | null {
  const v = getKv(LAST_SYNC);
  return v ? new Date(Number(v) * 1000).toISOString() : null;
}

export async function getDashboard(): Promise<{ dashboard: Dashboard; source: DataSource; connected: boolean }> {
  const source = dataSource();
  if (source === "fixtures") {
    // Demo mode: pin "today" so the sample data always has upcoming items, and load it on first view.
    process.env.SUBWATCH_TODAY ??= "2026-11-09";
    if (loadRecords().length === 0) await runSync();
  }
  const dashboard = buildDashboard(loadRecords(), {
    dismissed: dismissedKeys(),
    manualCancels: manualCancels(),
    paid: paidKeys(),
    reminders: reminderKeys(),
  });
  return { dashboard, source, connected: source === "fixtures" ? true : isConnected() };
}
