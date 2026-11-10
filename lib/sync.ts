import { FIXTURE_EMAILS } from "../fixtures/emails";
import { dismissedKeys, getKv, hasRecord, loadRecords, saveRecord, setKv } from "./db";
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
const CONCURRENCY = 5;

export async function inBatches<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

export async function runSync(): Promise<SyncResult> {
  const source = dataSource();
  const result: SyncResult = { source, listed: 0, processed: 0, relevant: 0, llmUsed: 0, errors: 0 };

  if (source === "fixtures") {
    result.listed = FIXTURE_EMAILS.length;
    for (const email of FIXTURE_EMAILS) {
      if (hasRecord(email.id)) continue;
      const rec = await extractEmail(email);
      saveRecord(rec);
      result.processed++;
      if (rec.relevant) result.relevant++;
      if (rec.method === "llm") result.llmUsed++;
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

  await inBatches(fresh, CONCURRENCY, async (id) => {
    try {
      const email = await fetchEmail(id);
      if (!email) return;
      const rec = await extractEmail(email);
      saveRecord(rec);
      result.processed++;
      if (rec.relevant) result.relevant++;
      if (rec.method === "llm") result.llmUsed++;
    } catch {
      result.errors++;
    }
  });

  // Only advance the cursor on a clean run so failed messages are retried next time.
  if (result.errors === 0) setKv(LAST_SYNC, String(startedAt));
  return result;
}

export async function getDashboard(): Promise<{ dashboard: Dashboard; source: DataSource; connected: boolean }> {
  const source = dataSource();
  if (source === "fixtures") {
    // Demo mode: pin "today" so the sample data always has upcoming items, and load it on first view.
    process.env.SUBWATCH_TODAY ??= "2026-11-09";
    if (loadRecords().length === 0) await runSync();
  }
  const dashboard = buildDashboard(loadRecords(), { dismissed: dismissedKeys() });
  return { dashboard, source, connected: source === "fixtures" ? true : isConnected() };
}
