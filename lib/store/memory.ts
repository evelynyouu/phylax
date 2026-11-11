import type { ExtractedRecord } from "../types";
import type { GmailConnection, MarkTable, Store } from "./types";

/** A fresh, empty in-memory store. Used for tests and the demo. */
export function memoryStore(userId = "memory"): Store {
  const records = new Map<string, ExtractedRecord>();
  const markTables = new Map<MarkTable, Map<string, string>>();
  let gmail: GmailConnection | null = null;
  const table = (t: MarkTable) => {
    let m = markTables.get(t);
    if (!m) markTables.set(t, (m = new Map()));
    return m;
  };
  return {
    userId,
    async hasRecord(emailId) {
      return records.has(emailId);
    },
    async saveRecord(r) {
      records.set(r.emailId, r);
    },
    async loadRecords() {
      return [...records.values()].sort((a, b) => a.emailDate.localeCompare(b.emailDate));
    },
    async getGmail() {
      return gmail ? { ...gmail } : null;
    },
    async setGmail(c) {
      gmail = c ? { ...c } : null;
    },
    async marks(t) {
      return new Map(table(t));
    },
    async setMark(t, key, on) {
      if (on) table(t).set(key, new Date().toISOString());
      else table(t).delete(key);
    },
  };
}

let demo: Store | null = null;

/** Process-wide demo store (userId "demo"). Starts empty; the sync fills it from fixtures. */
export function demoStore(): Store {
  return (demo ??= memoryStore("demo"));
}
