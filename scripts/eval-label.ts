// Blind labeling: shows each exported email without the extractor's prediction and saves your label.
// Usage: npm run eval:label            (resumes at the first unlabeled email)
//        npm run eval:label -- --redo <email id>
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { CorpusKeyError, EVAL_DIR, readCorpus, readLabels, writeLabels } from "../lib/eval/corpus";
import {
  candidates,
  KIND_ORDER,
  nextUnlabeled,
  parseAmount,
  parseDate,
  parseKind,
  parseLink,
  type Candidates,
  type Parsed,
} from "../lib/eval/label";
import type { CorpusEntry, Expected, Labels } from "../lib/eval/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local; rely on the environment.
}

const BODY_LIMIT = 3000;
const rl = createInterface({ input: stdin, output: stdout });

class Quit extends Error {}

async function ask(prompt: string): Promise<string> {
  const a = (await rl.question(prompt)).trim();
  if (a === "q") throw new Quit();
  return a;
}

async function askParsed<T>(prompt: string, parse: (s: string) => Parsed<T>): Promise<T | null> {
  for (;;) {
    const r = parse(await ask(prompt));
    if (r.ok) return r.value;
    console.log(`  ${r.error}`);
  }
}

async function askYesNo(prompt: string): Promise<boolean> {
  for (;;) {
    const a = (await ask(prompt)).toLowerCase();
    if (a === "y" || a === "n") return a === "y";
    console.log("  Type y or n.");
  }
}

function show(e: CorpusEntry, c: Candidates, pos: string) {
  const { email } = e;
  const body = email.bodyText.length > BODY_LIMIT
    ? `${email.bodyText.slice(0, BODY_LIMIT)}\n(+${email.bodyText.length - BODY_LIMIT} more chars)`
    : email.bodyText;
  console.log(`\n${"=".repeat(72)}\n${pos}  id ${email.id}`);
  console.log(`From:    ${email.from}\nSubject: ${email.subject}\nDate:    ${email.date}\n${"-".repeat(72)}`);
  console.log(body);
  console.log("-".repeat(72));
  c.amounts.forEach((a, i) => console.log(`  a${i + 1}  ${a}`));
  c.dates.forEach((d, i) => console.log(`  d${i + 1}  ${d}`));
  c.links.forEach((l, i) => console.log(`  l${i + 1}  ${l.text.slice(0, 40).padEnd(40)} ${l.href}`));
}

async function labelOne(e: CorpusEntry, c: Candidates): Promise<Expected> {
  const relevant = await askYesNo("Billing-relevant? (y/n) ");
  if (!relevant) {
    const kind = await askParsed("Kind: 7 marketing, 8 other: ", (s) =>
      s === "7" || s === "8" ? parseKind(s) : { ok: false, error: "Choose 7 or 8." }
    );
    return { relevant, kind: kind! };
  }
  console.log(KIND_ORDER.slice(0, 6).map((k, i) => `${i + 1} ${k}`).join(", "));
  const kind = await askParsed("Kind (1 to 6): ", (s) =>
    /^[1-6]$/.test(s) ? parseKind(s) : { ok: false, error: "Choose 1 to 6." }
  );
  const merchant = await askParsed<string>("Merchant (- for none): ", (s) =>
    !s ? { ok: false, error: "Enter a value, or - for none." } : { ok: true, value: s === "-" ? null : s }
  );
  const amount = await askParsed("Amount (aN, number, or -): ", (s) => parseAmount(s, c));
  const date = await askParsed("Due or renewal date (dN, YYYY-MM-DD, or -): ", (s) => parseDate(s, c));
  const cancelUrl = await askParsed("Cancel link (lN or -): ", (s) => parseLink(s, c));
  return { relevant, kind: kind!, merchant, amount, date, cancelUrl };
}

async function main() {
  let entries: CorpusEntry[];
  let labels: Labels;
  try {
    entries = readCorpus(EVAL_DIR);
    labels = readLabels(EVAL_DIR);
  } catch (e) {
    if (e instanceof CorpusKeyError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
  if (entries.length === 0) {
    console.error("No corpus in data/eval. Run npm run eval:export first.");
    process.exit(1);
  }

  const redoIdx = process.argv.indexOf("--redo");
  const redoId = redoIdx === -1 ? null : process.argv[redoIdx + 1];
  if (redoId && !entries.some((e) => e.email.id === redoId)) {
    console.error(`No email with id ${redoId} in the corpus.`);
    process.exit(1);
  }

  const start = nextUnlabeled(entries, labels);
  console.log(
    `${entries.length - entries.filter((e) => labels[e.email.id] === undefined).length} of ${entries.length} labeled` +
      (start === -1 ? "." : `, resuming at [${start + 1}/${entries.length}].`) +
      " Type q at any prompt to stop."
  );
  const skipped = new Set<string>();
  try {
    for (;;) {
      const i = redoId
        ? entries.findIndex((e) => e.email.id === redoId)
        : entries.findIndex((e) => labels[e.email.id] === undefined && !skipped.has(e.email.id));
      if (i === -1) break;
      const e = entries[i];
      const c = candidates(e.email);
      show(e, c, `[${i + 1}/${entries.length}]`);
      const label = await labelOne(e, c);
      console.log(JSON.stringify(label));
      const action = await askParsed<string>("Save? (y = save, r = redo, s = skip) ", (s) =>
        ["y", "r", "s"].includes(s) ? { ok: true, value: s } : { ok: false, error: "Type y, r, or s." }
      );
      if (action === "r") continue;
      if (action === "s") {
        skipped.add(e.email.id);
        if (redoId) break;
        continue;
      }
      labels = { ...labels, [e.email.id]: label };
      writeLabels(EVAL_DIR, labels);
      if (redoId) break;
    }
  } catch (err) {
    if (!(err instanceof Quit)) throw err;
  }
  rl.close();
  const done = entries.filter((e) => labels[e.email.id] !== undefined).length;
  console.log(`\nSaved. ${done} of ${entries.length} labeled.`);
}

main();
