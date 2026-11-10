import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CorpusKeyError,
  loadLabeledCases,
  readCorpus,
  readLabels,
  writeCorpus,
  writeLabels,
} from "../lib/eval/corpus";
import { ALL_MAIL_QUERY, exportCorpus, type ExportDeps } from "../lib/eval/export";
import { candidates, nextUnlabeled, parseAmount, parseDate, parseKind, parseLink } from "../lib/eval/label";
import { formatRate, formatReport } from "../lib/eval/report";
import { planExport, seededShuffle } from "../lib/eval/sample";
import { rate, scoreCases, wilson } from "../lib/eval/score";
import { syncQuery } from "../lib/gmail";
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

// ---- Task 2: corpus store ----

describe("corpus store", () => {
  let dir: string;
  let savedKey: string | undefined;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "subwatch-eval-"));
    savedKey = process.env.TOKEN_ENC_KEY;
    process.env.TOKEN_ENC_KEY = "a".repeat(64);
  });
  afterEach(() => {
    if (savedKey === undefined) delete process.env.TOKEN_ENC_KEY;
    else process.env.TOKEN_ENC_KEY = savedKey;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips corpus and labels, and stores no plaintext", () => {
    writeCorpus(dir, [entry("e1", "ZZSUBJECT"), entry("e2")]);
    writeLabels(dir, { e1: { relevant: true, kind: "receipt", amount: 9.99 } });
    expect(readCorpus(dir).map((e) => e.email.id)).toEqual(["e1", "e2"]);
    const file = path.join(dir, "corpus.jsonl.enc");
    expect(fs.readFileSync(file, "utf8")).not.toContain("ZZSUBJECT");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.readFileSync(path.join(dir, "labels.json.enc"), "utf8")).not.toContain("9.99");
    const cases = loadLabeledCases(dir);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ samples: ["query"], inQuery: true, expected: { amount: 9.99 } });
  });

  it("writes labels atomically and leaves no tmp file", () => {
    writeLabels(dir, { e1: { relevant: false, kind: "marketing" } });
    expect(fs.existsSync(path.join(dir, "labels.json.enc.tmp"))).toBe(false);
    expect(readLabels(dir).e1.kind).toBe("marketing");
  });

  it("returns empty results when nothing has been exported", () => {
    expect(readCorpus(dir)).toEqual([]);
    expect(readLabels(dir)).toEqual({});
  });

  it("throws CorpusKeyError when the key changed", () => {
    writeCorpus(dir, [entry("e1")]);
    writeLabels(dir, { e1: { relevant: false, kind: "other" } });
    process.env.TOKEN_ENC_KEY = "b".repeat(64);
    expect(() => readCorpus(dir)).toThrow(CorpusKeyError);
    expect(() => readCorpus(dir)).toThrow(/TOKEN_ENC_KEY/);
    expect(() => readLabels(dir)).toThrow(CorpusKeyError);
  });
});

// ---- Task 3: export ----

describe("export sampling", () => {
  it("seededShuffle is deterministic and a permutation", () => {
    const xs = Array.from({ length: 50 }, (_, i) => `m${i}`);
    const copy = [...xs];
    expect(seededShuffle(xs, 1)).toEqual(seededShuffle(xs, 1));
    expect(seededShuffle(xs, 1)).not.toEqual(seededShuffle(xs, 2));
    expect([...seededShuffle(xs, 1)].sort()).toEqual([...xs].sort());
    expect(xs).toEqual(copy);
  });

  it("planExport marks overlap and query membership", () => {
    const q = ["a", "b", "c"];
    const all = ["a", "b", "c", "x", "y", "z"];
    const plan = planExport(q, all, { nQuery: 3, nRandom: 6, seed: 1 });
    expect(plan.size).toBe(6);
    expect(plan.get("a")).toEqual({ samples: ["query", "random"], inQuery: true });
    expect(plan.get("x")).toEqual({ samples: ["random"], inQuery: false });
  });

  it("planExport sets inQuery from the full query list, not just the query sample", () => {
    const plan = planExport(["a", "b", "c"], ["a", "b", "c"], { nQuery: 0, nRandom: 3, seed: 1 });
    expect([...plan.values()].every((v) => v.inQuery && v.samples.join() === "random")).toBe(true);
  });

  it("exportCorpus skips messages that fail to fetch", async () => {
    const deps: ExportDeps = {
      listIds: async (q) => (q === ALL_MAIL_QUERY ? ["a", "b", "x"] : ["a", "b"]),
      fetchEmail: async (id) => {
        if (id === "b") throw new Error("404");
        return id === "x" ? null : rawEmail(id);
      },
    };
    const r = await exportCorpus(deps, { nQuery: 2, nRandom: 3, seed: 1, queryMax: 10, allMax: 10 });
    expect(r.entries.map((e) => e.email.id)).toEqual(["a"]);
    expect(r.entries[0]).toMatchObject({ samples: ["query", "random"], inQuery: true });
    expect(r.failed).toBe(2);
  });

  it("exportCorpus lists the production sync query", async () => {
    const seen: string[] = [];
    await exportCorpus(
      { listIds: async (q) => (seen.push(q), []), fetchEmail: async () => null },
      { nQuery: 1, nRandom: 1, seed: 1, queryMax: 10, allMax: 10 }
    );
    expect(seen).toEqual([syncQuery(null), ALL_MAIL_QUERY]);
  });

  it("syncQuery matches the production query", () => {
    expect(syncQuery(null)).toMatch(/^-in:spam -in:trash \(.*newer_than:400d$/);
    expect(syncQuery(1700000000)).toMatch(/after:1700000000$/);
  });
});

// ---- Task 4: labeling helpers ----

describe("labeling helpers", () => {
  const email = rawEmail("e1", {
    subject: "Your receipt",
    bodyText: "Total $9.99. Was $12.00. Renews Dec 14, 2026. Save $9.99! Annual plan $1234.00",
    links: [
      { href: "http://x.com/a", text: "a" },
      { href: "https://x.com/cancel", text: "Cancel" },
    ],
  });

  it("lists candidates from raw text, de-duplicated, https links only", () => {
    expect(candidates(email)).toEqual({
      amounts: [9.99, 12, 1234],
      dates: ["2026-12-14"],
      links: [{ href: "https://x.com/cancel", text: "Cancel" }],
    });
  });

  it("parses picks, literals, and explicit none", () => {
    const c = candidates(email);
    expect(parseAmount("a2", c)).toEqual({ ok: true, value: 12 });
    expect(parseAmount("$1,234.00", c)).toEqual({ ok: true, value: 1234 });
    expect(parseAmount("-", c)).toEqual({ ok: true, value: null });
    expect(parseDate("d1", c)).toEqual({ ok: true, value: "2026-12-14" });
    expect(parseDate("2027-01-05", c)).toEqual({ ok: true, value: "2027-01-05" });
    expect(parseDate("2026-02-30", c).ok).toBe(false);
    expect(parseLink("l1", c)).toEqual({ ok: true, value: "https://x.com/cancel" });
    expect(parseLink("-", c)).toEqual({ ok: true, value: null });
    expect(parseLink("https://evil.example", c).ok).toBe(false);
    expect(parseKind("3")).toEqual({ ok: true, value: "trial_ending" });
  });

  it("rejects empty input and out-of-range picks", () => {
    const c = candidates(email);
    for (const p of [parseAmount("", c), parseDate("  ", c), parseLink("", c), parseKind(""), parseKind("9"), parseAmount("a9", c), parseAmount("-5", c)]) {
      expect(p.ok).toBe(false);
    }
  });

  it("resumes at the first unlabeled email", () => {
    const entries = ["e1", "e2", "e3"].map((id) => entry(id));
    expect(nextUnlabeled(entries, { e1: { relevant: false, kind: "other" } })).toBe(1);
    const all = Object.fromEntries(entries.map((e) => [e.email.id, { relevant: false, kind: "other" as const }]));
    expect(nextUnlabeled(entries, all)).toBe(-1);
  });
});

// ---- Task 5: report ----

describe("report", () => {
  it("formats rates and n/a", () => {
    expect(formatRate(rate(12, 13))).toBe("92.3% (66.7 to 98.6, n=13)");
    expect(formatRate(rate(0, 0))).toBe("n/a (n=0)");
  });

  it("report contains aggregate numbers only, no email content", () => {
    const cases = [
      mkCase(
        { relevant: true, kind: "receipt", merchant: "ZZMERCHANT", cancelUrl: "https://zz.example/cancel?t=SECRET" },
        { email: { id: "zz-id-1", from: "ZZ <a@zz.example>", subject: "ZZSUBJECT" } }
      ),
    ];
    const r = scoreCases(cases, [mkPred({ merchant: "Other", cancelUrl: "https://zz.example/wrong" })]);
    expect(r.mismatches.length).toBeGreaterThan(0);
    const md = formatReport(r, null, { date: "2026-11-09", labeled: 1, corpus: 1, querySample: 1, randomSample: 0, model: null });
    for (const s of ["ZZSUBJECT", "ZZMERCHANT", "zz-id-1", "zz.example", "SECRET"]) expect(md).not.toContain(s);
    expect(md).toContain("| Relevance precision |");
    expect(md).toContain("not run");
    expect(md).not.toMatch(/\u2014/);
  });

  it("shows both columns when the LLM run is present", () => {
    const r = scoreCases([mkCase(R({ amount: 5 }))], [mkPred({ amount: 5 })]);
    const md = formatReport(r, r, { date: "2026-11-09", labeled: 1, corpus: 1, querySample: 1, randomSample: 0, model: "claude-haiku-5-5" });
    expect(md).toContain("| Amount precision | 100.0%");
    expect(md).not.toContain("not run");
    expect(md).toContain("claude-haiku-5-5");
  });
});
