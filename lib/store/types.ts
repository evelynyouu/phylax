import type { ExtractedRecord } from "../types";

export interface GmailConnection {
  gmailEmail: string;
  encTokens: string;
  lastSyncEpoch: number | null;
}

export type MarkTable = "dismissed" | "manual_cancels" | "paid" | "reminders";

/** Per-user storage. Every method is scoped to `userId`. */
export interface Store {
  userId: string;
  hasRecord(emailId: string): Promise<boolean>;
  saveRecord(r: ExtractedRecord): Promise<void>;
  /** Ordered by emailDate ascending. */
  loadRecords(): Promise<ExtractedRecord[]>;
  getGmail(): Promise<GmailConnection | null>;
  /** null deletes the connection. */
  setGmail(c: GmailConnection | null): Promise<void>;
  /** key -> ISO time it was set. */
  marks(table: MarkTable): Promise<Map<string, string>>;
  setMark(table: MarkTable, key: string, on: boolean): Promise<void>;
}
