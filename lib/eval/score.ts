import { extractEmail } from "../extract";
import { llmAvailable } from "../extract/llm";
import type { ExtractedRecord } from "../types";
import type { EvalCase, Expected } from "./types";

export interface Rate {
  k: number;
  n: number;
  value: number | null;
  ci: [number, number] | null;
}

export interface FieldScore {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: Rate;
  recall: Rate;
}

export type FieldName = "merchant" | "amount" | "date" | "cancel";
export const FIELD_NAMES: FieldName[] = ["merchant", "amount", "date", "cancel"];

export interface EvalResult {
  total: number;
  headline: number;
  relevance: { precision: Rate; recall: Rate; f1: number | null };
  kind: Rate;
  fields: Record<FieldName, FieldScore>;
  queryRecall: Rate;
  methods: Record<string, number>;
  mismatches: string[];
}

/** Wilson score interval for k successes out of n, clamped to [0, 1]. Null when n is 0. */
export function wilson(k: number, n: number, z = 1.96): [number, number] | null {
  if (n === 0) return null;
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

export function rate(k: number, n: number): Rate {
  return { k, n, value: n === 0 ? null : k / n, ci: wilson(k, n) };
}

type Value = string | number;

interface FieldSpec {
  label(e: Expected): Value | null | undefined;
  pred(p: ExtractedRecord): Value | null;
  equal(label: Value, pred: Value, e: Expected): boolean;
}

const FIELDS: Record<FieldName, FieldSpec> = {
  merchant: {
    label: (e) => e.merchant,
    pred: (p) => p.merchant,
    equal: (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase(),
  },
  amount: {
    label: (e) => e.amount,
    pred: (p) => p.amount,
    equal: (a, b) => Math.abs(Number(a) - Number(b)) < 0.005,
  },
  date: {
    label: (e) => e.date,
    pred: (p) => p.dueDate ?? p.renewalDate,
    equal: (a, b) => a === b,
  },
  cancel: {
    // With an exact URL label, compare URLs. With only hasCancel (fixtures), compare presence.
    label: (e) => (e.cancelUrl !== undefined ? e.cancelUrl : e.hasCancel === undefined ? undefined : e.hasCancel ? "present" : null),
    pred: (p) => p.cancelUrl,
    // Presence-only labels (hasCancel) match any predicted link.
    equal: (a, b, e) => (e.cancelUrl !== undefined ? a === b : true),
  },
};

const isHeadline = (c: EvalCase) => c.samples === undefined || c.samples.includes("query");

/** Pure scorer. predictions[i] is the extractor's output for cases[i]. */
export function scoreCases(cases: EvalCase[], predictions: ExtractedRecord[]): EvalResult {
  if (cases.length !== predictions.length) throw new Error("cases and predictions differ in length");
  let tp = 0, fp = 0, fn = 0, kindOk = 0, headline = 0;
  let qrK = 0, qrN = 0;
  const counts = Object.fromEntries(FIELD_NAMES.map((f) => [f, { tp: 0, fp: 0, fn: 0, tn: 0 }])) as Record<
    FieldName,
    { tp: number; fp: number; fn: number; tn: number }
  >;
  const methods: Record<string, number> = {};
  const mismatches: string[] = [];

  cases.forEach((c, i) => {
    const got = predictions[i];
    const exp = c.expected;

    if (c.samples?.includes("random") && exp.relevant) {
      qrN++;
      if (c.inQuery === true) qrK++;
    }
    if (!isHeadline(c)) return;

    headline++;
    methods[got.method] = (methods[got.method] ?? 0) + 1;
    const label = `${c.email.id} "${c.email.subject.slice(0, 48)}"`;

    if (got.relevant && exp.relevant) tp++;
    else if (got.relevant && !exp.relevant) fp++;
    else if (!got.relevant && exp.relevant) fn++;

    if (got.kind === exp.kind) kindOk++;
    else mismatches.push(`${label}: kind ${got.kind}, expected ${exp.kind}`);

    if (!exp.relevant) return;
    for (const f of FIELD_NAMES) {
      const spec = FIELDS[f];
      const L = spec.label(exp);
      if (L === undefined) continue;
      const P = spec.pred(got);
      const cnt = counts[f];
      const eq = L !== null && P !== null && spec.equal(L, P, exp);
      if (L !== null && P !== null) {
        if (eq) cnt.tp++;
        else {
          cnt.fp++;
          cnt.fn++;
        }
      } else if (L !== null) cnt.fn++;
      else if (P !== null) cnt.fp++;
      else cnt.tn++;
      if (!(eq || (L === null && P === null))) mismatches.push(`${label}: ${f} ${P}, expected ${L}`);
    }
  });

  const fields = Object.fromEntries(
    FIELD_NAMES.map((f) => {
      const c = counts[f];
      return [f, { ...c, precision: rate(c.tp, c.tp + c.fp), recall: rate(c.tp, c.tp + c.fn) }];
    })
  ) as Record<FieldName, FieldScore>;

  const precision = rate(tp, tp + fp);
  const recall = rate(tp, tp + fn);
  const f1 =
    precision.value === null || recall.value === null
      ? null
      : precision.value + recall.value === 0
        ? 0
        : (2 * precision.value * recall.value) / (precision.value + recall.value);

  return {
    total: cases.length,
    headline,
    relevance: { precision, recall, f1 },
    kind: rate(kindOk, headline),
    fields,
    queryRecall: rate(qrK, qrN),
    methods,
    mismatches,
  };
}

export async function runEval(cases: EvalCase[], opts: { useLlm: boolean }): Promise<EvalResult> {
  // Without a key extractEmail silently falls back to rules, which would label rules-only numbers "With LLM".
  if (opts.useLlm && !llmAvailable()) throw new Error("--llm needs ANTHROPIC_API_KEY (in .env.local or the environment).");
  const preds: ExtractedRecord[] = [];
  for (const c of cases) preds.push(await extractEmail(c.email, { useLlm: opts.useLlm }));
  return scoreCases(cases, preds);
}
