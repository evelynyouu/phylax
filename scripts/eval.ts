// Eval harness: runs extraction over labeled fixtures and reports precision and recall.
// Usage: npx tsx scripts/eval.ts [--llm]   (--llm enables the fallback when ANTHROPIC_API_KEY is set)
import { FIXTURES } from "../fixtures/emails";
import { extractEmail } from "../lib/extract";

export interface EvalResult {
  total: number;
  relevance: { precision: number; recall: number; f1: number };
  kindAccuracy: number;
  merchantAccuracy: number;
  amountAccuracy: number;
  dateAccuracy: number;
  cancelLinkAccuracy: number;
  methods: Record<string, number>;
  mismatches: string[];
}

export async function runEval(useLlm: boolean): Promise<EvalResult> {
  let tp = 0, fp = 0, fn = 0;
  let kindOk = 0;
  let merchOk = 0, merchN = 0;
  let amtOk = 0, amtN = 0;
  let dateOk = 0, dateN = 0;
  let cancelOk = 0, cancelN = 0;
  const methods: Record<string, number> = {};
  const mismatches: string[] = [];

  for (const { email, expected } of FIXTURES) {
    const got = await extractEmail(email, { useLlm });
    methods[got.method] = (methods[got.method] ?? 0) + 1;

    if (got.relevant && expected.relevant) tp++;
    else if (got.relevant && !expected.relevant) fp++;
    else if (!got.relevant && expected.relevant) fn++;

    const label = `${email.id} "${email.subject.slice(0, 48)}"`;
    if (got.kind === expected.kind) kindOk++;
    else mismatches.push(`${label}: kind ${got.kind}, expected ${expected.kind}`);

    if (expected.merchant !== undefined) {
      merchN++;
      if (got.merchant?.toLowerCase() === expected.merchant.toLowerCase()) merchOk++;
      else mismatches.push(`${label}: merchant ${got.merchant}, expected ${expected.merchant}`);
    }
    if (expected.amount !== undefined) {
      amtN++;
      if (got.amount === expected.amount) amtOk++;
      else mismatches.push(`${label}: amount ${got.amount}, expected ${expected.amount}`);
    }
    if (expected.date !== undefined) {
      dateN++;
      const d = got.dueDate ?? got.renewalDate;
      if (d === expected.date) dateOk++;
      else mismatches.push(`${label}: date ${d}, expected ${expected.date}`);
    }
    if (expected.hasCancel !== undefined) {
      cancelN++;
      if (!!got.cancelUrl === expected.hasCancel) cancelOk++;
      else mismatches.push(`${label}: cancel link ${got.cancelUrl}, expected present=${expected.hasCancel}`);
    }
  }

  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  const ratio = (a: number, b: number) => (b === 0 ? 1 : a / b);
  return {
    total: FIXTURES.length,
    relevance: { precision, recall, f1: (2 * precision * recall) / Math.max(1e-9, precision + recall) },
    kindAccuracy: kindOk / FIXTURES.length,
    merchantAccuracy: ratio(merchOk, merchN),
    amountAccuracy: ratio(amtOk, amtN),
    dateAccuracy: ratio(dateOk, dateN),
    cancelLinkAccuracy: ratio(cancelOk, cancelN),
    methods,
    mismatches,
  };
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

async function main() {
  const useLlm = process.argv.includes("--llm");
  const r = await runEval(useLlm);
  console.log(`Emails: ${r.total}   extraction paths: ${JSON.stringify(r.methods)}`);
  console.log(
    `Relevance  precision ${pct(r.relevance.precision)}  recall ${pct(r.relevance.recall)}  F1 ${pct(r.relevance.f1)}`
  );
  console.log(`Kind accuracy        ${pct(r.kindAccuracy)}`);
  console.log(`Merchant accuracy    ${pct(r.merchantAccuracy)}`);
  console.log(`Amount accuracy      ${pct(r.amountAccuracy)}`);
  console.log(`Date accuracy        ${pct(r.dateAccuracy)}`);
  console.log(`Cancel link accuracy ${pct(r.cancelLinkAccuracy)}`);
  if (r.mismatches.length) {
    console.log(`\nMismatches (${r.mismatches.length}):`);
    for (const m of r.mismatches) console.log("  " + m);
  }
}

if (process.argv[1]?.endsWith("eval.ts")) main();
