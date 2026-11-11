// Export a seeded sample of your Gmail into an encrypted local corpus for labeling.
// Usage: npm run eval:export -- --user <uuid> [--query 160] [--random 60] [--seed 1] [--query-max 1500] [--all-max 5000] [--force]
// --user is your Subwatch account id (Supabase Auth > Users). It must equal EVAL_OWNER_USER_ID
// (your own account): the script refuses any other user. It reads that account's Gmail
// connection with the service role key (SUPABASE_SERVICE_ROLE_KEY in .env.local).
import { corpusExists, EVAL_DIR, writeCorpus, writeMeta } from "../lib/eval/corpus";
import { evalOwnerError, exportCorpus } from "../lib/eval/export";
import { fetchEmail, gmailConfigured, isConnected, listIdsForQuery, SYNC_MAX_MESSAGES } from "../lib/gmail";
import { supabaseStore } from "../lib/store/supabase";
import { supabaseAdmin } from "../lib/supabase/admin";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local; rely on the environment.
}

function flag(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number(process.argv[i + 1]);
  if (!Number.isInteger(n) || n < 0) {
    console.error(`--${name} needs a non-negative integer`);
    process.exit(1);
  }
  return n;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function userFlag(): string {
  const i = process.argv.indexOf("--user");
  const id = i === -1 ? undefined : process.argv[i + 1];
  if (!id || !UUID.test(id)) fail("Pass --user <uuid>, your Subwatch account id from Supabase Auth > Users.");
  const refused = evalOwnerError(id, process.env.EVAL_OWNER_USER_ID);
  if (refused) fail(refused);
  return id;
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const opts = {
    nQuery: flag("query", 160),
    nRandom: flag("random", 60),
    seed: flag("seed", 1),
    queryMax: flag("query-max", SYNC_MAX_MESSAGES), // what sync reads on its first run
    allMax: flag("all-max", 5000),
  };
  const userId = userFlag();
  if (!gmailConfigured()) fail("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.");
  const store = supabaseStore(supabaseAdmin(), userId);
  if (!(await isConnected(store))) fail("That account has not connected Gmail. Run npm run dev, sign in and choose Connect Gmail first.");
  if (corpusExists(EVAL_DIR) && !process.argv.includes("--force")) {
    fail("data/eval already has a corpus. Labels are keyed to it; pass --force to replace it.");
  }

  console.log("Listing and fetching messages...");
  const { entries, failed, listing } = await exportCorpus(
    { listIds: (q, max) => listIdsForQuery(store, q, max), fetchEmail: (id) => fetchEmail(store, id) },
    opts,
  );
  if (entries.length === 0) fail(`Nothing was exported (${failed} failed). The existing corpus, if any, is unchanged.`);
  writeCorpus(EVAL_DIR, entries);
  writeMeta(EVAL_DIR, { exportedAt: new Date().toISOString(), ...listing });
  if (listing.queryCapped) {
    console.log(`Note: the query listing stopped at the newest ${listing.queryListed} matches, the same cap sync uses.`);
  }
  if (listing.allCapped) {
    console.log(
      `Note: the all-mail listing stopped at the newest ${listing.allListed} messages, so older mail is not sampled. ` +
        "Raise --all-max to cover more of the 400 days."
    );
  }

  const q = entries.filter((e) => e.samples.includes("query")).length;
  const r = entries.filter((e) => e.samples.includes("random")).length;
  const both = entries.filter((e) => e.samples.length === 2).length;
  console.log(
    `Exported ${entries.length} emails to data/eval (${q} query, ${r} random, ${both} in both), ${failed} failed. ` +
      "This file contains email bodies; delete data/eval when done."
  );
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
