import { describe, expect, it } from "vitest";
import { scoreCases, wilson } from "../lib/eval/score";
import type { CorpusEntry, EvalCase, Expected, SampleSource } from "../lib/eval/types";
import type { ExtractedRecord, RawEmail } from "../lib/types";

// ---- shared helpers (reused by later describe blocks) ----

export function rawEmail(id: string, over: Partial<RawEmail> = {}): RawEmail {
  return {
    id,
    from: "Acme <billing@acme.com>",
    subject: `Subject ${id}`,
    date: "2026-11-01T15:00:00Z",
    bodyText: "",
    links: [],
    ...over,
  };
}

let caseCounter = 0;
export function mkCase(
  expected: Expected,
  opts: { email?: Partial<RawEmail>; samples?: SampleSource[]; inQuery?: boolean } = {}
): EvalCase {
  caseCounter += 1;
  const id = opts.email?.id ?? `c${caseCounter}`;
  return { email: rawEmail(id, opts.email), expected, samples: opts.samples, inQuery: opts.inQuery };
}

export function mkPred(over: Partial<ExtractedRecord> = {}): ExtractedRecord {
  return {
    emailId: "p",
    emailDate: "2026-11-01T15:00:00Z",
    kind: "receipt",
    relevant: true,
    merchant: null,
    merchantKey: null,
    amount: null,
    currency: null,
    cadence: null,
    dueDate: null,
    renewalDate: null,
    cancelUrl: null,
    cancelUrlTrusted: false,
    confidence: 0.9,
    method: "rules",
    ...over,
  };
}

export function entry(id: string, subject?: string): CorpusEntry {
  return { email: rawEmail(id, subject ? { subject } : {}), samples: ["query"], inQuery: true };
}

const R = (extra: Partial<Expected> = {}): Expected => ({ relevant: true, kind: "receipt", ...extra });

// ---- Task 1: scoring ----

describe("wilson", () => {
  it("matches the textbook interval", () => {
    const [lo, hi] = wilson(8, 10)!;
    expect(lo).toBeCloseTo(0.4902, 3);
    expect(hi).toBeCloseTo(0.9434, 3);
    expect(wilson(10, 10)![1]).toBe(1);
    expect(wilson(0, 0)).toBeNull();
  });
});

describe("scoreCases", () => {
  it("counts tp/fp/fn/tn per field and treats undefined labels as unscored", () => {
    const labels = [9.99, 9.99, null, null];
    const predsAmt = [9.990000001, 5, 7, null];
    const cases = labels.map((a) => mkCase(R({ amount: a })));
    const preds = predsAmt.map((a) => mkPred({ amount: a }));
    cases.push(mkCase(R()));
    preds.push(mkPred({ amount: 3 }));
    const r = scoreCases(cases, preds);
    expect(r.fields.amount).toMatchObject({ tp: 1, fp: 2, fn: 1, tn: 1 });
    expect(r.fields.amount.precision.value).toBeCloseTo(1 / 3);
    expect(r.fields.amount.recall.value).toBeCloseTo(1 / 2);
  });

  it("compares merchants case- and whitespace-insensitively", () => {
    const r = scoreCases([mkCase(R({ merchant: "Netflix" }))], [mkPred({ merchant: " netflix " })]);
    expect(r.fields.merchant.tp).toBe(1);
  });

  it("scores only relevant labeled cases for fields", () => {
    const r = scoreCases([mkCase({ relevant: false, kind: "marketing", amount: 5 })], [mkPred({ amount: 9 })]);
    expect(r.fields.amount).toMatchObject({ tp: 0, fp: 0, fn: 0, tn: 0 });
  });

  it("reports n/a for zero denominators instead of 100%", () => {
    const r = scoreCases([], []);
    expect(r.fields.merchant.precision).toEqual({ k: 0, n: 0, value: null, ci: null });
    expect(r.queryRecall.value).toBeNull();
    expect(r.relevance.f1).toBeNull();
  });

  it("excludes random-only cases from headline metrics and uses them for query recall", () => {
    const cases = [
      mkCase(R(), { samples: ["query"], inQuery: true }),
      mkCase(R(), { samples: ["query"], inQuery: true }),
      mkCase(R(), { samples: ["random"], inQuery: true }),
      mkCase(R(), { samples: ["random"], inQuery: false }),
      mkCase(R(), { samples: ["random"], inQuery: false }),
      mkCase({ relevant: false, kind: "other" }, { samples: ["random"], inQuery: false }),
    ];
    const r = scoreCases(cases, cases.map(() => mkPred()));
    expect(r.headline).toBe(2);
    expect(r.total).toBe(6);
    expect(r.queryRecall).toMatchObject({ k: 1, n: 3 });
  });

  it("computes relevance precision and recall on the headline set", () => {
    const cases = [mkCase(R()), mkCase(R()), mkCase({ relevant: false, kind: "marketing" })];
    const preds = [mkPred(), mkPred({ relevant: false, kind: "marketing" }), mkPred()];
    const r = scoreCases(cases, preds);
    expect(r.relevance.precision).toMatchObject({ k: 1, n: 2 });
    expect(r.relevance.recall).toMatchObject({ k: 1, n: 2 });
    expect(r.relevance.f1).toBeCloseTo(0.5);
  });

  it("scores cancelUrl exactly when labeled, presence otherwise", () => {
    const r1 = scoreCases([mkCase(R({ cancelUrl: "https://a.com/x" }))], [mkPred({ cancelUrl: "https://a.com/y" })]);
    expect(r1.fields.cancel).toMatchObject({ tp: 0, fp: 1, fn: 1 });
    const r2 = scoreCases([mkCase(R({ hasCancel: true }))], [mkPred({ cancelUrl: "https://a.com/y" })]);
    expect(r2.fields.cancel.tp).toBe(1);
    const r3 = scoreCases([mkCase(R({ hasCancel: false }))], [mkPred({ cancelUrl: "https://a.com/y" })]);
    expect(r3.fields.cancel.fp).toBe(1);
  });

  it("compares dates against dueDate, falling back to renewalDate", () => {
    const r = scoreCases(
      [mkCase(R({ date: "2026-12-01" })), mkCase(R({ date: "2026-12-02" }))],
      [mkPred({ renewalDate: "2026-12-01" }), mkPred({ dueDate: "2026-12-02", renewalDate: "2027-01-01" })]
    );
    expect(r.fields.date.tp).toBe(2);
  });
});
