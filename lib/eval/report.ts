import type { ListingInfo } from "./export";
import { FIELD_NAMES, type EvalResult, type FieldName, type Rate } from "./score";

// Aggregate-only markdown report, safe to commit. It never reads EvalResult.mismatches,
// which carry email ids and subjects.

export interface ReportMeta {
  date: string;
  labeled: number;
  corpus: number;
  querySample: number;
  randomSample: number;
  model: string | null;
  listing?: ListingInfo | null;
}

export const FIELD_LABELS: Record<FieldName, string> = {
  merchant: "Merchant",
  amount: "Amount",
  date: "Date",
  cancel: "Cancel link",
};

export function formatRate(r: Rate): string {
  if (r.value === null || r.ci === null) return `n/a (n=${r.n})`;
  const p = (x: number) => (x * 100).toFixed(1);
  return `${p(r.value)}% (${p(r.ci[0])} to ${p(r.ci[1])}, n=${r.n})`;
}

function paths(r: EvalResult): string {
  return `rules ${r.methods.rules ?? 0}, llm ${r.methods.llm ?? 0}`;
}

function sampleText(meta: ReportMeta): string {
  const l = meta.listing;
  const query = `a seeded random sample of ${meta.querySample} emails matched by the app's production Gmail query` +
    (l?.queryCapped ? ` (drawn from the newest ${l.queryListed} matches, the same cap sync uses on its first run)` : "");
  const all = l?.allCapped
    ? `from the newest ${l.allListed} messages (the listing cap was reached, so older mail is not represented)`
    : "from all mail (spam and trash excluded, last 400 days)";
  return `${query}, plus a seeded random sample of ${meta.randomSample} emails ${all}.`;
}

export function formatReport(rules: EvalResult, llm: EvalResult | null, meta: ReportMeta): string {
  const rows: [string, (r: EvalResult) => string][] = [
    ["Relevance precision", (r) => formatRate(r.relevance.precision)],
    ["Relevance recall", (r) => formatRate(r.relevance.recall)],
    ["Kind accuracy", (r) => formatRate(r.kind)],
  ];
  for (const f of FIELD_NAMES) {
    rows.push([`${FIELD_LABELS[f]} precision`, (r) => formatRate(r.fields[f].precision)]);
    rows.push([`${FIELD_LABELS[f]} recall`, (r) => formatRate(r.fields[f].recall)]);
  }
  rows.push(["Extraction paths", paths]);

  const llmCell = (fn: (r: EvalResult) => string) => (llm ? fn(llm) : "not run");
  const table = [
    "| Metric | Rules only | With LLM |",
    "| --- | --- | --- |",
    ...rows.map(([name, fn]) => `| ${name} | ${fn(rules)} | ${llmCell(fn)} |`),
  ].join("\n");

  return `# Subwatch extraction eval

Run ${meta.date}. ${meta.labeled} of ${meta.corpus} exported emails labeled.

## Method

- Emails come from the author's own Gmail: ${sampleText(meta)}
- One labeler (the author) labeled each email blind, without seeing the app's prediction.
- Extraction metrics use only the query sample, because that is what the app processes. Field metrics count only billing-relevant emails with a label for that field.
- Precision is correct predictions over all predictions made; recall is correct predictions over all labeled values. Brackets are Wilson 95% intervals; n is the denominator.
- LLM column: ${meta.model ? `fallback enabled, model ${meta.model}` : "not run"}.

## Results

${table}

Gmail query recall (random sample): ${formatRate(rules.queryRecall)}. This is the share of billing-relevant emails in the all-mail sample that the production query finds.
`;
}
