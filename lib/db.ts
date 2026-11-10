import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { ExtractedRecord } from "./types";

const DB_PATH = process.env.SUBWATCH_DB ?? path.join(process.cwd(), "data", "subwatch.db");

let _db: Database.Database | null = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS records (
    email_id TEXT PRIMARY KEY,
    email_date TEXT NOT NULL,
    json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS dismissed (
    merchant_key TEXT PRIMARY KEY,
    dismissed_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS manual_cancels (
    merchant_key TEXT PRIMARY KEY,
    cancelled_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS paid (
    bill_key TEXT PRIMARY KEY,
    paid_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reminders (
    bill_key TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );
`;

export function db(): Database.Database {
  if (_db) return _db;
  if (DB_PATH !== ":memory:") fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.exec(SCHEMA);
  return _db;
}

/** Test helper: swap in a fresh in-memory database. */
export function resetDbForTests() {
  _db?.close();
  _db = new Database(":memory:");
  _db.exec(SCHEMA);
}

export function saveRecord(r: ExtractedRecord) {
  db()
    .prepare(
      `INSERT INTO records (email_id, email_date, json) VALUES (?, ?, ?)
       ON CONFLICT(email_id) DO UPDATE SET json = excluded.json, email_date = excluded.email_date`
    )
    .run(r.emailId, r.emailDate, JSON.stringify(r));
}

export function loadRecords(): ExtractedRecord[] {
  const rows = db().prepare("SELECT json FROM records ORDER BY email_date ASC").all() as { json: string }[];
  return rows.map((r) => JSON.parse(r.json) as ExtractedRecord);
}

export function hasRecord(emailId: string): boolean {
  return !!db().prepare("SELECT 1 FROM records WHERE email_id = ?").get(emailId);
}

export function getKv(key: string): string | null {
  const row = db().prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setKv(key: string, value: string) {
  db()
    .prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function dismissMerchant(merchantKey: string) {
  db()
    .prepare("INSERT OR REPLACE INTO dismissed (merchant_key, dismissed_at) VALUES (?, ?)")
    .run(merchantKey, new Date().toISOString());
}

export function undismissMerchant(merchantKey: string) {
  db().prepare("DELETE FROM dismissed WHERE merchant_key = ?").run(merchantKey);
}

export function dismissedKeys(): Set<string> {
  const rows = db().prepare("SELECT merchant_key FROM dismissed").all() as { merchant_key: string }[];
  return new Set(rows.map((r) => r.merchant_key));
}

// ---- "I've cancelled it" ----

export function setManualCancel(merchantKey: string) {
  db()
    .prepare("INSERT OR REPLACE INTO manual_cancels (merchant_key, cancelled_at) VALUES (?, ?)")
    .run(merchantKey, new Date().toISOString());
}

export function clearManualCancel(merchantKey: string) {
  db().prepare("DELETE FROM manual_cancels WHERE merchant_key = ?").run(merchantKey);
}

export function manualCancels(): Map<string, string> {
  const rows = db().prepare("SELECT merchant_key, cancelled_at FROM manual_cancels").all() as {
    merchant_key: string;
    cancelled_at: string;
  }[];
  return new Map(rows.map((r) => [r.merchant_key, r.cancelled_at]));
}

// ---- Bills: paid and reminders ----

export function markPaid(billKey: string) {
  db().prepare("INSERT OR REPLACE INTO paid (bill_key, paid_at) VALUES (?, ?)").run(billKey, new Date().toISOString());
}

export function unmarkPaid(billKey: string) {
  db().prepare("DELETE FROM paid WHERE bill_key = ?").run(billKey);
}

export function paidKeys(): Set<string> {
  const rows = db().prepare("SELECT bill_key FROM paid").all() as { bill_key: string }[];
  return new Set(rows.map((r) => r.bill_key));
}

export function setReminder(billKey: string, on: boolean) {
  if (on) {
    db().prepare("INSERT OR REPLACE INTO reminders (bill_key, created_at) VALUES (?, ?)").run(billKey, new Date().toISOString());
  } else {
    db().prepare("DELETE FROM reminders WHERE bill_key = ?").run(billKey);
  }
}

export function reminderKeys(): Set<string> {
  const rows = db().prepare("SELECT bill_key FROM reminders").all() as { bill_key: string }[];
  return new Set(rows.map((r) => r.bill_key));
}
