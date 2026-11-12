import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseStore } from "../lib/store/supabase";
import { describeStore } from "./store-contract";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: the suite skips below.
}

const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const emailA = env.SUPABASE_TEST_EMAIL_A;
const emailB = env.SUPABASE_TEST_EMAIL_B;
const password = env.SUPABASE_TEST_PASSWORD;
const configured = Boolean(url && anon && emailA && emailB && password);

const tables = ["records", "gmail_connections", "dismissed", "manual_cancels", "paid", "reminders", "subscription_edits", "merchant_categories"] as const;

describe.skipIf(!configured)("supabase (live, RLS)", () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let idA = "";

  async function signIn(email: string) {
    const client = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: password! });
    if (error || !data.user) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
    return { client, id: data.user.id };
  }

  async function clean(client: SupabaseClient, id: string) {
    for (const t of tables) await client.from(t).delete().eq("user_id", id);
  }

  beforeAll(async () => {
    const a = await signIn(emailA!);
    const b = await signIn(emailB!);
    clientA = a.client;
    clientB = b.client;
    idA = a.id;
    await clean(clientA, idA);
  });

  afterEach(async () => {
    await clean(clientA, idA);
  });

  describeStore("supabase", () => supabaseStore(clientA, idA));

  const seed: Record<(typeof tables)[number], Record<string, unknown>> = {
    records: { email_id: "a1", email_date: "2026-10-01T00:00:00Z", data: { emailId: "a1" } },
    gmail_connections: { gmail_email: "a@x.com", enc_tokens: "enc", last_sync_epoch: null },
    dismissed: { key: "k" },
    manual_cancels: { key: "k" },
    paid: { key: "k" },
    reminders: { key: "k" },
    subscription_edits: { merchant_key: "k", merchant: "K", amount: 5, manual: true },
    merchant_categories: { merchant_key: "k", category: "music" },
  };
  const patch: Record<(typeof tables)[number], Record<string, unknown>> = {
    records: { data: { hacked: true } },
    gmail_connections: { enc_tokens: "hacked" },
    dismissed: { key: "hacked" },
    manual_cancels: { key: "hacked" },
    paid: { key: "hacked" },
    reminders: { key: "hacked" },
    subscription_edits: { amount: 999 },
    merchant_categories: { category: "gaming" },
  };

  it.each(tables)("user B cannot read, insert, update or delete user A's rows in %s", async (t) => {
    const { error: seedErr } = await clientA.from(t).insert({ user_id: idA, ...seed[t] });
    expect(seedErr).toBeNull();
    const before = (await clientA.from(t).select("*").eq("user_id", idA)).data;
    expect(before).toHaveLength(1);

    expect((await clientB.from(t).select("*").eq("user_id", idA)).data).toEqual([]);
    const ins = await clientB.from(t).insert({ user_id: idA, ...seed[t], ...(t === "records" ? { email_id: "b1" } : t === "gmail_connections" ? {} : t === "subscription_edits" || t === "merchant_categories" ? { merchant_key: "bk" } : { key: "bk" }) });
    // 42501 = RLS violation. with check runs before the unique index, so a broken policy gives 23505 or null.
    expect(ins.error?.code).toBe("42501");
    await clientB.from(t).update(patch[t]).eq("user_id", idA);
    await clientB.from(t).delete().eq("user_id", idA);

    expect((await clientA.from(t).select("*").eq("user_id", idA)).data).toEqual(before);
  });

  it.each(tables)("an anonymous client reads nothing from %s", async (t) => {
    const { error: seedErr } = await clientA.from(t).insert({ user_id: idA, ...seed[t] });
    expect(seedErr).toBeNull();
    const anonClient = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anonClient.from(t).select("*");
    // With anon access revoked this is a permission error (data null); an empty array is also safe.
    expect(error !== null || (data ?? []).length === 0).toBe(true);
    expect(data ?? []).toEqual([]);
  });
});
