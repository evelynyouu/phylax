import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExtractedRecord } from "../types";
import type { GmailConnection, MarkTable, Store } from "./types";

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Per-user store over Supabase. Row level security enforces isolation; user_id is set explicitly too. */
export function supabaseStore(client: SupabaseClient, userId: string): Store {
  return {
    userId,
    async hasRecord(emailId) {
      const { data, error } = await client
        .from("records").select("email_id").eq("user_id", userId).eq("email_id", emailId).maybeSingle();
      check(error);
      return data !== null;
    },
    async saveRecord(r) {
      const { error } = await client.from("records").upsert(
        { user_id: userId, email_id: r.emailId, email_date: r.emailDate, data: r },
        { onConflict: "user_id,email_id" },
      );
      check(error);
    },
    async loadRecords() {
      const { data, error } = await client
        .from("records").select("data").eq("user_id", userId).order("email_date", { ascending: true });
      check(error);
      return (data ?? []).map((row) => row.data as ExtractedRecord);
    },
    async getGmail() {
      const { data, error } = await client
        .from("gmail_connections").select("gmail_email, enc_tokens, last_sync_epoch").eq("user_id", userId).maybeSingle();
      check(error);
      if (!data) return null;
      return {
        gmailEmail: data.gmail_email,
        encTokens: data.enc_tokens,
        lastSyncEpoch: data.last_sync_epoch === null ? null : Number(data.last_sync_epoch),
      };
    },
    async setGmail(c: GmailConnection | null) {
      if (!c) {
        const { error } = await client.from("gmail_connections").delete().eq("user_id", userId);
        return check(error);
      }
      const { error } = await client.from("gmail_connections").upsert(
        { user_id: userId, gmail_email: c.gmailEmail, enc_tokens: c.encTokens, last_sync_epoch: c.lastSyncEpoch },
        { onConflict: "user_id" },
      );
      check(error);
    },
    async marks(table: MarkTable) {
      const { data, error } = await client.from(table).select("key, created_at").eq("user_id", userId);
      check(error);
      return new Map((data ?? []).map((row) => [row.key as string, new Date(row.created_at).toISOString()]));
    },
    async setMark(table: MarkTable, key, on) {
      if (on) {
        const { error } = await client.from(table).upsert(
          { user_id: userId, key, created_at: new Date().toISOString() },
          { onConflict: "user_id,key" },
        );
        check(error);
      } else {
        const { error } = await client.from(table).delete().eq("user_id", userId).eq("key", key);
        check(error);
      }
    },
  };
}
