// Eval harness: runs extraction over labeled emails and reports precision and recall per field.
// Usage: npx tsx scripts/eval.ts [--llm]                      labeled fixtures
//        npx tsx scripts/eval.ts --real [--llm] [--report p]  your labeled emails in data/eval
// --llm enables the fallback (needs ANTHROPIC_API_KEY). --report writes an aggregate-only markdown file.
import fs from "node:fs";
import path from "node:path";
import { FIXTURES } from "../fixtures/emails";
import { CorpusKeyError, EVAL_DIR, loadLabeledCases, readCorpus, readMeta } from "../lib/eval/corpus";
import { FIELD_LABELS, formatRate, formatReport } from "../lib/eval/report";
import { FIELD_NAMES, runEval, type EvalResult } from "../lib/eval/score";

export function printResult(r: EvalResult): void {
  console.log(`Emails: ${r.total} (headline set ${r.headline})   extraction paths: ${JSON.stringify(r.methods)}`);
  console.log(`Relevance    precision ${formatRate(r.relevance.precision)}  recall ${formatRate(r.relevance.recall)}`);
  console.log(`Kind         accuracy  ${formatRate(r.kind)}`);
  for (const f of FIELD_NAMES) {
    const s = r.fields[f];
    console.log(`${FIELD_LABELS[f].padEnd(12)} precision ${formatRate(s.precision)}  recall ${formatRate(s.recall)}`);
  }
  if (r.queryRecall.n > 0) console.log(`Gmail query recall (random sample) ${formatRate(r.queryRecall)}`);
  if (r.mismatches.length) {
    console.log(`\nMismatches (${r.mismatches.length}):`);
    for (const m of r.mismatches) console.log("  " + m);
  }
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function argAfter(name: string): string | null {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  const v = process.argv[i + 1];
  if (!v || v.startsWith("--")) fail(`${name} needs a value`);
  return v;
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local; rely on the environment.
  }
  const useLlm = process.argv.includes("--llm");
  const real = process.argv.includes("--real");
  const reportPath = argAfter("--report");

  if (!real) {
    if (reportPath) fail("--report needs --real; the fixture eval is a regression check, not a reportable number.");
    printResult(await runEval(FIXTURES, { useLlm }));
    return;
  }

  let cases, corpusSize;
  try {
    cases = loadLabeledCases(EVAL_DIR);
    corpusSize = readCorpus(EVAL_DIR).length;
  } catch (e) {
    if (e instanceof CorpusKeyError) fail(e.message);
    throw e;
  }
  if (cases.length === 0) fail("No labeled emails in data/eval. Run npm run eval:export, then npm run eval:label.");

  const rules = await runEval(cases, { useLlm: false });
  const llm = useLlm ? await runEval(cases, { useLlm: true }) : null;
  console.log("Rules only");
  printResult(rules);
  if (llm) {
    console.log("\nWith LLM fallback");
    printResult(llm);
  }

  if (reportPath) {
    const md = formatReport(rules, llm, {
      date: new Date().toLocaleDateString("en-CA"), // local YYYY-MM-DD
      labeled: cases.length,
      corpus: corpusSize,
      querySample: cases.filter((c) => c.samples?.includes("query")).length,
      randomSample: cases.filter((c) => c.samples?.includes("random")).length,
      model: useLlm ? (process.env.SUBWATCH_LLM_MODEL ?? "claude-haiku-5-5") : null,
      listing: readMeta(EVAL_DIR),
    });
    fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
    fs.writeFileSync(reportPath, md);
    console.log(`\nWrote ${reportPath} (aggregate numbers only).`);
  }
}

if (process.argv[1]?.endsWith("eval.ts")) main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
