import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cadence, ExtractedRecord } from "../types";
import type { GmailConnection, MarkTable, Store } from "./types";

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const KNOWN_IDS_CHUNK = 200;

/** Per-user store over Supabase. Row level security enforces isolation; user_id is set explicitly too. */
export function supabaseStore(client: SupabaseClient, userId: string): Store {
  return {
    userId,
    async knownIds(ids) {
      const known = new Set<string>();
      // Chunked so the id list stays well inside PostgREST's URL length limit.
      for (let i = 0; i < ids.length; i += KNOWN_IDS_CHUNK) {
        const { data, error } = await client
          .from("records").select("email_id").eq("user_id", userId).in("email_id", ids.slice(i, i + KNOWN_IDS_CHUNK));
        check(error);
        for (const row of data ?? []) known.add(row.email_id as string);
      }
      return known;
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
        .from("gmail_connections").select("gmail_email, enc_tokens, last_sync_epoch, needs_reconnect").eq("user_id", userId).maybeSingle();
      check(error);
      if (!data) return null;
      return {
        gmailEmail: data.gmail_email,
        encTokens: data.enc_tokens,
        lastSyncEpoch: data.last_sync_epoch === null ? null : Number(data.last_sync_epoch),
        needsReconnect: data.needs_reconnect === true,
      };
    },
    async setGmail(c: GmailConnection | null) {
      if (!c) {
        const { error } = await client.from("gmail_connections").delete().eq("user_id", userId);
        return check(error);
      }
      const { error } = await client.from("gmail_connections").upsert(
        { user_id: userId, gmail_email: c.gmailEmail, enc_tokens: c.encTokens, last_sync_epoch: c.lastSyncEpoch, needs_reconnect: c.needsReconnect },
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
    async listEdits() {
      const { data, error } = await client
        .from("subscription_edits")
        .select("merchant_key, merchant, amount, currency, cadence, next_charge_date, manual, updated_at")
        .eq("user_id", userId);
      check(error);
      return (data ?? []).map((row) => ({
        merchantKey: row.merchant_key as string,
        merchant: (row.merchant as string | null) ?? null,
        amount: row.amount === null ? null : Number(row.amount),
        currency: (row.currency as string | null) ?? null,
        cadence: (row.cadence as Cadence | null) ?? null,
        nextChargeDate: (row.next_charge_date as string | null) ?? null,
        manual: row.manual === true,
        updatedAt: new Date(row.updated_at).toISOString(),
      }));
    },
    async saveEdit(e) {
      const { error } = await client.from("subscription_edits").upsert(
        {
          user_id: userId,
          merchant_key: e.merchantKey,
          merchant: e.merchant,
          amount: e.amount,
          currency: e.currency,
          cadence: e.cadence,
          next_charge_date: e.nextChargeDate,
          manual: e.manual,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,merchant_key" },
      );
      check(error);
    },
    async deleteEdit(merchantKey) {
      const { error } = await client.from("subscription_edits").delete().eq("user_id", userId).eq("merchant_key", merchantKey);
      check(error);
    },
  };
}
