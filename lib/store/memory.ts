import type { ExtractedRecord } from "../types";
import type { Category } from "../categories";
import type { GmailConnection, MarkTable, Store, SubscriptionEdit } from "./types";

/** A fresh, empty in-memory store, for tests and local scripts. */
export function memoryStore(userId = "memory"): Store {
  const records = new Map<string, ExtractedRecord>();
  const markTables = new Map<MarkTable, Map<string, string>>();
  let gmail: GmailConnection | null = null;
  const edits = new Map<string, SubscriptionEdit>();
  const categories = new Map<string, Category>();
  const table = (t: MarkTable) => {
    let m = markTables.get(t);
    if (!m) markTables.set(t, (m = new Map()));
    return m;
  };
  return {
    userId,
    async knownIds(ids) {
      return new Set(ids.filter((id) => records.has(id)));
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
    async listEdits() {
      return [...edits.values()].map((e) => ({ ...e }));
    },
    async saveEdit(e) {
      edits.set(e.merchantKey, { ...e, updatedAt: new Date().toISOString() });
    },
    async deleteEdit(merchantKey) {
      edits.delete(merchantKey);
    },
    async listCategories() {
      return new Map(categories);
    },
    async setCategory(merchantKey, category) {
      if (category) categories.set(merchantKey, category);
      else categories.delete(merchantKey);
    },
  };
}
