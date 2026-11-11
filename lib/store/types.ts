import type { Cadence, ExtractedRecord } from "../types";

export interface GmailConnection {
  gmailEmail: string;
  encTokens: string;
  lastSyncEpoch: number | null;
  /** Google refused the refresh token (invalid_grant); the user must reconnect. Records stay. */
  needsReconnect: boolean;
}

export type MarkTable = "dismissed" | "manual_cancels" | "paid" | "reminders";

/**
 * A user's correction to a subscription the email reader found, or a recurring payment the user
 * added by hand (manual). Null fields leave the email-derived value in place.
 */
export interface SubscriptionEdit {
  merchantKey: string;
  merchant: string | null;
  amount: number | null;
  currency: string | null;
  cadence: Cadence | null;
  nextChargeDate: string | null; // YYYY-MM-DD
  manual: boolean;
  updatedAt: string;
}

/** Per-user storage. Every method is scoped to `userId`. */
export interface Store {
  userId: string;
  /** Which of these email ids already have a stored record. One call for the whole list. */
  knownIds(ids: string[]): Promise<Set<string>>;
  saveRecord(r: ExtractedRecord): Promise<void>;
  /** Ordered by emailDate ascending. */
  loadRecords(): Promise<ExtractedRecord[]>;
  getGmail(): Promise<GmailConnection | null>;
  /** null deletes the connection. */
  setGmail(c: GmailConnection | null): Promise<void>;
  /** key -> ISO time it was set. */
  marks(table: MarkTable): Promise<Map<string, string>>;
  setMark(table: MarkTable, key: string, on: boolean): Promise<void>;
  listEdits(): Promise<SubscriptionEdit[]>;
  /** Upsert by merchantKey. */
  saveEdit(e: Omit<SubscriptionEdit, "updatedAt">): Promise<void>;
  deleteEdit(merchantKey: string): Promise<void>;
}
