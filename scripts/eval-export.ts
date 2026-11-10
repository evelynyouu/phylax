// Export a seeded sample of your Gmail into an encrypted local corpus for labeling.
// Usage: npm run eval:export -- [--query 160] [--random 60] [--seed 1] [--query-max 5000] [--all-max 5000] [--force]
import { corpusExists, EVAL_DIR, writeCorpus } from "../lib/eval/corpus";
import { exportCorpus } from "../lib/eval/export";
import { fetchEmail, gmailConfigured, isConnected, listIdsForQuery } from "../lib/gmail";

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

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const opts = {
    nQuery: flag("query", 160),
    nRandom: flag("random", 60),
    seed: flag("seed", 1),
    queryMax: flag("query-max", 5000),
    allMax: flag("all-max", 5000),
  };
  if (!gmailConfigured()) fail("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.");
  if (!isConnected()) fail("Gmail is not connected. Run npm run dev and choose Connect Gmail first.");
  if (corpusExists(EVAL_DIR) && !process.argv.includes("--force")) {
    fail("data/eval already has a corpus. Labels are keyed to it; pass --force to replace it.");
  }

  console.log("Listing and fetching messages...");
  const { entries, failed } = await exportCorpus({ listIds: listIdsForQuery, fetchEmail }, opts);
  writeCorpus(EVAL_DIR, entries);

  const q = entries.filter((e) => e.samples.includes("query")).length;
  const r = entries.filter((e) => e.samples.includes("random")).length;
  const both = entries.filter((e) => e.samples.length === 2).length;
  console.log(
    `Exported ${entries.length} emails to data/eval (${q} query, ${r} random, ${both} in both), ${failed} failed. ` +
      "This file contains email bodies; delete data/eval when done."
  );
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
