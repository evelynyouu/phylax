// Eval harness: runs extraction over labeled emails and reports precision and recall per field.
// Usage: npx tsx scripts/eval.ts [--llm]   (--llm enables the fallback when ANTHROPIC_API_KEY is set)
import { FIXTURES } from "../fixtures/emails";
import { FIELD_NAMES, runEval, type EvalResult, type Rate } from "../lib/eval/score";

const FIELD_LABELS: Record<string, string> = {
  merchant: "Merchant",
  amount: "Amount",
  date: "Date",
  cancel: "Cancel link",
};

export function formatRateShort(r: Rate): string {
  if (r.value === null || r.ci === null) return `n/a (n=${r.n})`;
  const p = (x: number) => (x * 100).toFixed(1);
  return `${p(r.value)}% (${p(r.ci[0])} to ${p(r.ci[1])}, n=${r.n})`;
}

export function printResult(r: EvalResult): void {
  console.log(`Emails: ${r.total} (headline set ${r.headline})   extraction paths: ${JSON.stringify(r.methods)}`);
  console.log(`Relevance    precision ${formatRateShort(r.relevance.precision)}  recall ${formatRateShort(r.relevance.recall)}`);
  console.log(`Kind         accuracy  ${formatRateShort(r.kind)}`);
  for (const f of FIELD_NAMES) {
    const s = r.fields[f];
    console.log(
      `${FIELD_LABELS[f].padEnd(12)} precision ${formatRateShort(s.precision)}  recall ${formatRateShort(s.recall)}`
    );
  }
  if (r.queryRecall.n > 0) console.log(`Gmail query recall (random sample) ${formatRateShort(r.queryRecall)}`);
  if (r.mismatches.length) {
    console.log(`\nMismatches (${r.mismatches.length}):`);
    for (const m of r.mismatches) console.log("  " + m);
  }
}

async function main() {
  const useLlm = process.argv.includes("--llm");
  printResult(await runEval(FIXTURES, { useLlm }));
}

if (process.argv[1]?.endsWith("eval.ts")) main();
