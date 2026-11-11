import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseStore } from "../lib/store/supabase";
import { describeStore, rec } from "./store-contract";

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

const tables = ["records", "gmail_connections", "dismissed", "manual_cancels", "paid", "reminders"] as const;

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

  it("user B cannot read or write user A's rows with the anon key", async () => {
    const storeA = supabaseStore(clientA, idA);
    await storeA.saveRecord(rec("a1", "2026-10-01T00:00:00Z"));
    await storeA.setGmail({ gmailEmail: "a@x.com", encTokens: "enc", lastSyncEpoch: null });
    const { data } = await clientB.from("records").select("*").eq("user_id", idA);
    expect(data).toEqual([]);
    expect((await clientB.from("gmail_connections").select("*")).data).toEqual([]);
    const ins = await clientB.from("paid").insert({ user_id: idA, key: "x|2026-11-20" });
    expect(ins.error).not.toBeNull();
  });

  it("an anonymous client reads nothing", async () => {
    await supabaseStore(clientA, idA).saveRecord(rec("a1", "2026-10-01T00:00:00Z"));
    const anonClient = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await anonClient.from("records").select("*");
    expect(data ?? []).toEqual([]);
  });
});
