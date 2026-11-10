# Real-Data Eval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export a sample of the author's real Gmail into an encrypted local corpus, label it blind in a terminal CLI, and have `npm run eval:real` report per-field precision and recall with 95% confidence intervals, rules-only and with the LLM fallback, plus an aggregate-only markdown report safe to commit.

**Architecture:** Scoring becomes a pure function `scoreCases(cases, predictions)` in `lib/eval/score.ts`, shared by the fixture eval and the real eval. The corpus and labels live in `data/eval/` (already gitignored), each encrypted with the existing `lib/crypto.ts`. Export and labeling are thin CLIs in `scripts/` over pure, tested helpers in `lib/eval/`. The corpus mixes a random sample of production-query mail (for extractor metrics) with a random sample of all mail (to estimate how much billing mail the Gmail query misses).

**Tech Stack:** TypeScript, tsx, Vitest, googleapis, Node 24 (`process.loadEnvFile`, `node:readline/promises`), existing `lib/crypto.ts` AES-256-GCM.

**Spec:** `docs/superpowers/specs/2026-11-09-real-data-eval.md`

## Global Constraints

- No em dashes in any copy: CLI output, report markdown, README. Use "to" for ranges ("85.1 to 96.4").
- Gmail access stays `gmail.readonly`. No new scopes.
- Email bodies exist on disk only in `data/eval/corpus.jsonl.enc`, one `encrypt()` payload per line, file mode `0o600`. Labels live in `data/eval/labels.json.enc`, encrypted the same way (cancel URLs can carry account tokens).
- Nothing derived from an individual email (id, sender, subject, body, URL, amount) may appear in the committed report. Mismatch lines go to the terminal only.
- Labeling is blind: the labeler never sees the extractor's prediction.
- A label of "absent" is explicit (`null`), distinct from "not labeled" (`undefined`). Empty input at a labeling prompt is an error, never an implicit `null`.
- A metric with a zero denominator is reported as `n/a`, never as 100%. (The current `ratio()` in `scripts/eval.ts` returns 1 for 0/0; this plan removes that.)
- Confidence intervals: Wilson score interval, z = 1.96.
- The export uses exactly the production list query, `syncQuery(null)` from `lib/gmail.ts`, so "in query" means what sync sees.
- `npm test`, `npm run eval`, `npm run eval:llm`, `npx tsc --noEmit`, and `npm run lint` must pass after every task.
- No Next.js code is touched. If a task ends up touching `app/`, read `node_modules/next/dist/docs/` first (AGENTS.md).
- Prerequisite: the project is not yet a git repo. Before Task 1 run `git init && git add -A && git commit -m "chore: baseline"` (`.gitignore` already excludes `/data` and `.env*`).

## Review Focus

1. **0/0 metrics.** A field with no labeled cases, or a random sample with no relevant emails, must print `n/a (n=0)`, not 100%. Test in Task 1.
2. **Report leaks email content.** The committed report must contain no subject, sender, id, or URL from the corpus. Test in Task 5.
3. **Wrong or rotated key.** If `TOKEN_ENC_KEY` changed or `data/.token-key` was regenerated, reading the corpus throws `CorpusKeyError` naming `TOKEN_ENC_KEY` and `data/.token-key`, not a raw GCM stack trace. Test in Task 2.
4. **Interrupted labeling.** Ctrl-C mid-session must not corrupt or lose saved labels, and the next run resumes at the first unlabeled email. Labels are written atomically (tmp then rename) after every email. Test in Task 2 (atomic write) and Task 4 (`nextUnlabeled`).
5. **A message fails to fetch mid-export** (deleted, or a transient API error). The export skips it, counts it in `failed`, and still writes the rest. Test in Task 3.

---

### Task 1: Pure scoring core with per-field precision and recall

**Files:**
- Create: `lib/eval/types.ts`
- Create: `lib/eval/score.ts`
- Create: `tests/eval.test.ts`
- Modify: `fixtures/emails.ts:1-16` (import `Expected`, `EvalCase` from `lib/eval/types`; keep `export type Fixture = EvalCase`)
- Modify: `scripts/eval.ts` (remove `runEval` and `EvalResult`; the CLI calls `runEval(FIXTURES, { useLlm })` from `lib/eval/score.ts`)
- Modify: `tests/pipeline.test.ts:3,154-162` (new import and new result shape)

**Interfaces:**
- Produces, in `lib/eval/types.ts`:
  ```ts
  export type SampleSource = "query" | "random";
  export interface Expected {
    relevant: boolean;
    kind: EmailKind;
    merchant?: string | null;   // undefined = not labeled, null = labeled absent
    amount?: number | null;
    date?: string | null;       // YYYY-MM-DD, compared to dueDate ?? renewalDate
    hasCancel?: boolean;        // fixtures only; ignored when cancelUrl is defined
    cancelUrl?: string | null;
  }
  export interface EvalCase { email: RawEmail; expected: Expected; samples?: SampleSource[]; inQuery?: boolean }
  export interface CorpusEntry { email: RawEmail; samples: SampleSource[]; inQuery: boolean }
  export type Labels = Record<string, Expected>; // keyed by email.id
  ```
- Produces, in `lib/eval/score.ts`:
  ```ts
  export interface Rate { k: number; n: number; value: number | null; ci: [number, number] | null }
  export interface FieldScore { tp: number; fp: number; fn: number; tn: number; precision: Rate; recall: Rate }
  export type FieldName = "merchant" | "amount" | "date" | "cancel";
  export interface EvalResult {
    total: number; headline: number;
    relevance: { precision: Rate; recall: Rate; f1: number | null };
    kind: Rate;
    fields: Record<FieldName, FieldScore>;
    queryRecall: Rate;
    methods: Record<string, number>;
    mismatches: string[];
  }
  export function wilson(k: number, n: number, z?: number): [number, number] | null;
  export function rate(k: number, n: number): Rate;
  export function scoreCases(cases: EvalCase[], predictions: ExtractedRecord[]): EvalResult;
  export async function runEval(cases: EvalCase[], opts: { useLlm: boolean }): Promise<EvalResult>;
  ```

Scoring rules (`scoreCases`, predictions[i] belongs to cases[i]):
- Headline set: cases whose `samples` is undefined or includes `"query"`. `relevance`, `kind`, `fields`, `methods`, `mismatches` use only the headline set. `headline` is its size.
- Fields are scored only on headline cases with `expected.relevant === true`, and only when that field's label is not `undefined`.
- Per field, with label L and prediction P: L and P non-null and equal is TP; both non-null and different is FP and FN; L non-null, P null is FN; L null, P non-null is FP; both null is TN. precision = `rate(tp, tp+fp)`, recall = `rate(tp, tp+fn)`.
- Equality: merchant by `trim().toLowerCase()`; amount by `Math.abs(a - b) < 0.005`; date by string equality against `P.dueDate ?? P.renewalDate`; cancel by exact `cancelUrl` string when `expected.cancelUrl !== undefined`, else by presence (`hasCancel` true means L non-null).
- `queryRecall`: over cases whose `samples` includes `"random"` and `expected.relevant`, k = count with `inQuery === true`.
- `rate(k, 0)` returns `{ k, n: 0, value: null, ci: null }`. `f1` is null when either side is null.
- Wilson: `center = (p + z²/2n) / (1 + z²/n)`, `margin = z·sqrt(p(1-p)/n + z²/4n²) / (1 + z²/n)`, clamped to [0, 1].

- [ ] **Step 1: Write the failing tests in `tests/eval.test.ts`**

```ts
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
  // Test helpers defined once at the top of this file and reused by later tasks:
  //   rawEmail(id: string, over?: Partial<RawEmail>): RawEmail
  //   mkCase(expected: Expected, opts?: { email?: Partial<RawEmail>; samples?: SampleSource[]; inQuery?: boolean }): EvalCase
  //   mkPred(over?: Partial<ExtractedRecord>): ExtractedRecord  (every nullable field null, relevant true, method "rules")
  //   entry(id: string, subject?: string): CorpusEntry          (samples ["query"], inQuery true)
  it("counts tp/fp/fn/tn per field and treats undefined labels as unscored", () => {
    // 4 relevant headline cases, amount labels [9.99, 9.99, null, null],
    // predictions        [9.990000001, 5, 7, null], 5th case label undefined pred 3
    const r = scoreCases(cases, preds);
    expect(r.fields.amount).toMatchObject({ tp: 1, fp: 2, fn: 1, tn: 1 });
    expect(r.fields.amount.precision.value).toBeCloseTo(1 / 3);
    expect(r.fields.amount.recall.value).toBeCloseTo(1 / 2);
  });
  it("compares merchants case- and whitespace-insensitively", () => {
    // label "Netflix", pred " netflix " -> tp 1
  });
  it("reports n/a for zero denominators instead of 100%", () => {
    const r = scoreCases([], []);
    expect(r.fields.merchant.precision).toEqual({ k: 0, n: 0, value: null, ci: null });
    expect(r.queryRecall.value).toBeNull();
    expect(r.relevance.f1).toBeNull();
  });
  it("excludes random-only cases from headline metrics and uses them for query recall", () => {
    // 2 query cases (relevant), 3 random-only relevant cases with inQuery [true, false, false],
    // 1 random-only non-relevant case
    const r = scoreCases(cases, preds);
    expect(r.headline).toBe(2);
    expect(r.queryRecall).toMatchObject({ k: 1, n: 3 });
  });
  it("scores cancelUrl exactly when labeled, presence otherwise", () => {
    // label cancelUrl "https://a.com/x", pred "https://a.com/y" -> fp 1, fn 1
    // label hasCancel true (no cancelUrl), pred "https://a.com/y" -> tp 1
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/eval.test.ts`
Expected: FAIL, cannot resolve `../lib/eval/score`.

- [ ] **Step 3: Create `lib/eval/types.ts` and `lib/eval/score.ts` with the interfaces above.** `runEval` calls `extractEmail(c.email, { useLlm })` sequentially and passes the results to `scoreCases`. Mismatch lines keep today's format: `` `${email.id} "${subject.slice(0, 48)}": amount 5, expected 9.99` ``.

- [ ] **Step 4: Point `fixtures/emails.ts`, `scripts/eval.ts`, and `tests/pipeline.test.ts` at the new module.** `scripts/eval.ts` prints, per field, `precision 97.1% (91.8 to 99.0, n=34)  recall ...`, and `n/a (n=0)` for null values. Replace the regression test body with:

```ts
const r = await runEval(FIXTURES, { useLlm: false });
expect(r.relevance.precision.value).toBeGreaterThanOrEqual(0.95);
expect(r.relevance.recall.value).toBeGreaterThanOrEqual(0.95);
expect(r.fields.amount.recall.value).toBeGreaterThanOrEqual(0.95);
expect(r.fields.date.recall.value).toBeGreaterThanOrEqual(0.95);
```

- [ ] **Step 5: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run eval`
Expected: all tests pass; `npm run eval` prints 45 emails and per-field lines with no `100%` for any field whose fixtures carry no labels (those show `n/a`).

- [ ] **Step 6: Commit**

```bash
git add lib/eval tests/eval.test.ts tests/pipeline.test.ts fixtures/emails.ts scripts/eval.ts
git commit -m "feat(eval): per-field precision/recall with Wilson intervals"
```

---

### Task 2: Encrypted corpus and label store

**Files:**
- Create: `lib/eval/corpus.ts`
- Test: `tests/eval.test.ts` (new `describe("corpus store")`)

**Interfaces:**
- Consumes: `CorpusEntry`, `Labels`, `EvalCase` from `lib/eval/types.ts`; `encrypt`, `decrypt` from `lib/crypto.ts`.
- Produces:
  ```ts
  export const EVAL_DIR: string; // path.join(process.cwd(), "data", "eval")
  export class CorpusKeyError extends Error {}
  export function corpusExists(dir: string): boolean;
  export function writeCorpus(dir: string, entries: CorpusEntry[]): void;  // corpus.jsonl.enc, mode 0o600, mkdir -p
  export function readCorpus(dir: string): CorpusEntry[];                  // [] when missing
  export function readLabels(dir: string): Labels;                         // {} when missing
  export function writeLabels(dir: string, labels: Labels): void;          // labels.json.enc.tmp then renameSync
  export function loadLabeledCases(dir: string): EvalCase[];               // corpus order, labeled only
  ```
- A decrypt failure (GCM auth error) in `readCorpus` or `readLabels` is rethrown as `CorpusKeyError` with message: `Cannot decrypt data/eval with the current key. It was written with a different TOKEN_ENC_KEY or data/.token-key.`

- [ ] **Step 1: Write the failing tests.** Each test uses `fs.mkdtempSync(os.tmpdir())` and sets `process.env.TOKEN_ENC_KEY` to 64 hex chars in `beforeEach`, restoring it in `afterEach`.

```ts
it("round-trips corpus and labels, and stores no plaintext", () => {
  writeCorpus(dir, [entry("e1", "ZZSUBJECT"), entry("e2")]);
  writeLabels(dir, { e1: { relevant: true, kind: "receipt", amount: 9.99 } });
  expect(readCorpus(dir).map((e) => e.email.id)).toEqual(["e1", "e2"]);
  expect(fs.readFileSync(path.join(dir, "corpus.jsonl.enc"), "utf8")).not.toContain("ZZSUBJECT");
  expect((fs.statSync(path.join(dir, "corpus.jsonl.enc")).mode & 0o777)).toBe(0o600);
  expect(loadLabeledCases(dir)).toHaveLength(1);
  expect(loadLabeledCases(dir)[0]).toMatchObject({ samples: ["query"], inQuery: true, expected: { amount: 9.99 } });
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
  process.env.TOKEN_ENC_KEY = "b".repeat(64);
  expect(() => readCorpus(dir)).toThrow(CorpusKeyError);
  expect(() => readCorpus(dir)).toThrow(/TOKEN_ENC_KEY/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/eval.test.ts -t "corpus store"`
Expected: FAIL, cannot resolve `../lib/eval/corpus`.

- [ ] **Step 3: Implement `lib/eval/corpus.ts`.** One `encrypt(JSON.stringify(entry))` per line; labels are one `encrypt(JSON.stringify(labels))` payload.

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/eval/corpus.ts tests/eval.test.ts
git commit -m "feat(eval): encrypted local corpus and label store"
```

---

### Task 3: Gmail export of a two-part sample

**Files:**
- Modify: `lib/gmail.ts:84-102` (extract `syncQuery`, add `listIdsForQuery`, reimplement `listMessageIds` on top)
- Modify: `lib/sync.ts:25` (export `inBatches`)
- Create: `lib/eval/sample.ts`
- Create: `lib/eval/export.ts`
- Create: `scripts/eval-export.ts`
- Modify: `package.json` scripts (`"eval:export": "tsx scripts/eval-export.ts"`)
- Test: `tests/eval.test.ts`

**Interfaces:**
- Consumes: `CorpusEntry`, `SampleSource` (Task 1); `writeCorpus`, `corpusExists`, `EVAL_DIR` (Task 2).
- Produces:
  ```ts
  // lib/gmail.ts
  export function syncQuery(afterEpochSeconds: number | null): string; // exactly today's q expression
  export async function listIdsForQuery(q: string, max: number): Promise<string[]>; // result length <= max
  // lib/sync.ts
  export async function inBatches<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]>;
  // lib/eval/sample.ts
  export function seededShuffle<T>(items: T[], seed: number): T[]; // mulberry32 + Fisher-Yates, input untouched
  export function planExport(
    queryIds: string[], allIds: string[],
    opts: { nQuery: number; nRandom: number; seed: number }
  ): Map<string, { samples: SampleSource[]; inQuery: boolean }>;
  // lib/eval/export.ts
  export interface ExportDeps {
    listIds(q: string, max: number): Promise<string[]>;
    fetchEmail(id: string): Promise<RawEmail | null>;
  }
  export interface ExportOptions { nQuery: number; nRandom: number; seed: number; queryMax: number; allMax: number }
  export const ALL_MAIL_QUERY = "-in:spam -in:trash newer_than:400d";
  export async function exportCorpus(deps: ExportDeps, opts: ExportOptions): Promise<{ entries: CorpusEntry[]; failed: number }>;
  ```
- `planExport`: query sample is the first `nQuery` of `seededShuffle(queryIds, seed)`; random sample is the first `nRandom` of `seededShuffle(allIds, seed + 1)`. An id in both gets `samples: ["query", "random"]`. `inQuery` is membership in the full `queryIds`, not just the sample. Map order: query sample first, then random-only ids.
- `exportCorpus` lists `syncQuery(null)` with `queryMax` and `ALL_MAIL_QUERY` with `allMax`, plans, fetches with `inBatches(..., 5, ...)`. A fetch that throws or returns null increments `failed` and is skipped.
- CLI flags and defaults: `--query 160 --random 60 --seed 1 --query-max 5000 --all-max 5000 --force`. Calls `process.loadEnvFile(".env.local")` inside try/catch. Exits 1 with a clear message if Gmail is not connected, or if `corpusExists(EVAL_DIR)` and no `--force`. Final line: `Exported 214 emails to data/eval (160 query, 60 random, 6 in both), 2 failed. This file contains email bodies; delete data/eval when done.`

- [ ] **Step 1: Write the failing tests**

```ts
it("seededShuffle is deterministic and a permutation", () => {
  const xs = Array.from({ length: 50 }, (_, i) => `m${i}`);
  expect(seededShuffle(xs, 1)).toEqual(seededShuffle(xs, 1));
  expect(seededShuffle(xs, 1)).not.toEqual(seededShuffle(xs, 2));
  expect([...seededShuffle(xs, 1)].sort()).toEqual([...xs].sort());
});
it("planExport marks overlap and query membership", () => {
  const q = ["a", "b", "c"]; const all = ["a", "b", "c", "x", "y", "z"];
  const plan = planExport(q, all, { nQuery: 3, nRandom: 6, seed: 1 });
  expect(plan.size).toBe(6);
  expect(plan.get("a")).toEqual({ samples: ["query", "random"], inQuery: true });
  expect(plan.get("x")).toEqual({ samples: ["random"], inQuery: false });
});
it("exportCorpus skips messages that fail to fetch", async () => {
  const deps: ExportDeps = {
    listIds: async (q) => (q === ALL_MAIL_QUERY ? ["a", "b", "x"] : ["a", "b"]),
    fetchEmail: async (id) => { if (id === "b") throw new Error("404"); return id === "x" ? null : rawEmail(id); },
  };
  const r = await exportCorpus(deps, { nQuery: 2, nRandom: 3, seed: 1, queryMax: 10, allMax: 10 });
  expect(r.entries.map((e) => e.email.id)).toEqual(["a"]);
  expect(r.failed).toBe(2);
});
it("syncQuery matches the production query", () => {
  expect(syncQuery(null)).toMatch(/newer_than:400d$/);
  expect(syncQuery(1700000000)).toMatch(/after:1700000000$/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/eval.test.ts`
Expected: FAIL, missing exports `syncQuery`, `seededShuffle`, `exportCorpus`.

- [ ] **Step 3: Implement the `lib/gmail.ts` refactor, `inBatches` export, `lib/eval/sample.ts`, and `lib/eval/export.ts`.** `listMessageIds(after, max)` becomes `listIdsForQuery(syncQuery(after), max)` with its current default of 1500 kept.

- [ ] **Step 4: Implement `scripts/eval-export.ts` and the npm script.** Wire `ExportDeps` to `listIdsForQuery` and `fetchEmail` from `lib/gmail.ts`, then `writeCorpus(EVAL_DIR, entries)`.

- [ ] **Step 5: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run eval:export`
Expected: tests pass. Without Google credentials, `eval:export` exits 1 with `Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.`; with credentials but no token, it exits 1 with `Gmail is not connected. Run npm run dev and choose Connect Gmail first.` (check `gmailConfigured()` before `isConnected()`).

- [ ] **Step 6: Commit**

```bash
git add lib/gmail.ts lib/sync.ts lib/eval/sample.ts lib/eval/export.ts scripts/eval-export.ts package.json tests/eval.test.ts
git commit -m "feat(eval): export a seeded query + random sample from Gmail"
```

---

### Task 4: Blind labeling CLI

**Files:**
- Create: `lib/eval/label.ts`
- Create: `scripts/eval-label.ts`
- Modify: `package.json` scripts (`"eval:label": "tsx scripts/eval-label.ts"`)
- Test: `tests/eval.test.ts`

**Interfaces:**
- Consumes: `readCorpus`, `readLabels`, `writeLabels`, `EVAL_DIR` (Task 2); `Expected`, `CorpusEntry`, `Labels` (Task 1); `findDates` from `lib/extract/dates.ts`.
- Produces:
  ```ts
  export interface Candidates { amounts: number[]; dates: string[]; links: EmailLink[] }
  export type Parsed<T> = { ok: true; value: T | null } | { ok: false; error: string };
  export const KIND_ORDER: EmailKind[]; // ["receipt","renewal_notice","trial_ending","payment_due","price_change","cancellation","marketing","other"]
  export function candidates(email: RawEmail): Candidates;
  export function parseKind(input: string): Parsed<EmailKind>;       // "1".."8"
  export function parseAmount(input: string, c: Candidates): Parsed<number>; // "a2", "-", "12.50", "$1,234.00"
  export function parseDate(input: string, c: Candidates): Parsed<string>;   // "d1", "-", valid YYYY-MM-DD
  export function parseLink(input: string, c: Candidates): Parsed<string>;   // "l3", "-" only; no free-text URLs
  export function nextUnlabeled(entries: CorpusEntry[], labels: Labels): number; // index, or -1 when done
  ```
- `candidates`: amounts are unique numbers matched by `/[$€£]\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?/g` (the alternation keeps `$1234.00` from matching as `$123`) over `subject + "\n" + bodyText`, in order of first appearance; dates are unique `findDates(text, email.date)` isos in order; links are `email.links` with `https:` hrefs only. Candidates come from raw text, never from `extractWithRules`, so the labeler is not shown the extractor's choice.
- `""` (after trim) is an error for every parser. Out-of-range indexes (`a9` with 2 amounts) are errors.

CLI flow per email, shown as `[37/214]`: print From, Subject, Date, the first 3000 chars of body (with `(+N more chars)`), numbered amounts `a1..`, dates `d1..`, links `l1..` (link text and full href). Prompts: `Billing-relevant? (y/n)`; if n, `Kind: 7 marketing, 8 other`; if y, kind 1 to 6, merchant (free text, `-` for none), amount, date, cancel link. Then print the label and ask `Save? (y = save, r = redo, s = skip)`. `writeLabels` after every save. `q` at any prompt exits after the last save. Invalid input reprints the parser's error and the same prompt. `--redo <id>` relabels one id. On start it prints `N of M labeled`.

- [ ] **Step 1: Write the failing tests**

```ts
const email = rawEmail("e1", {
  subject: "Your receipt",
  bodyText: "Total $9.99. Was $12.00. Renews Dec 14, 2026. Save $9.99!",
  links: [{ href: "http://x.com/a", text: "a" }, { href: "https://x.com/cancel", text: "Cancel" }],
});
it("lists candidates from raw text, de-duplicated, https links only", () => {
  expect(candidates(email)).toEqual({ amounts: [9.99, 12], dates: ["2026-12-14"], links: [{ href: "https://x.com/cancel", text: "Cancel" }] });
});
it("parses picks, literals, and explicit none", () => {
  const c = candidates(email);
  expect(parseAmount("a2", c)).toEqual({ ok: true, value: 12 });
  expect(parseAmount("$1,234.00", c)).toEqual({ ok: true, value: 1234 });
  expect(parseAmount("-", c)).toEqual({ ok: true, value: null });
  expect(parseDate("d1", c)).toEqual({ ok: true, value: "2026-12-14" });
  expect(parseDate("2026-02-30", c).ok).toBe(false);
  expect(parseLink("l1", c)).toEqual({ ok: true, value: "https://x.com/cancel" });
  expect(parseLink("https://evil.example", c).ok).toBe(false);
  expect(parseKind("3")).toEqual({ ok: true, value: "trial_ending" });
});
it("rejects empty input and out-of-range picks", () => {
  const c = candidates(email);
  for (const p of [parseAmount("", c), parseDate("  ", c), parseLink("", c), parseKind(""), parseAmount("a9", c)]) expect(p.ok).toBe(false);
});
it("resumes at the first unlabeled email", () => {
  const entries = ["e1", "e2", "e3"].map((id) => ({ email: rawEmail(id), samples: ["query"], inQuery: true }) as CorpusEntry);
  expect(nextUnlabeled(entries, { e1: { relevant: false, kind: "other" } })).toBe(1);
  expect(nextUnlabeled(entries, Object.fromEntries(entries.map((e) => [e.email.id, { relevant: false, kind: "other" }])))).toBe(-1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/eval.test.ts`
Expected: FAIL, cannot resolve `../lib/eval/label`.

- [ ] **Step 3: Implement `lib/eval/label.ts`.**

- [ ] **Step 4: Implement `scripts/eval-label.ts` with `node:readline/promises` and the npm script.** Loads `.env.local` like Task 3. Catches `CorpusKeyError` and prints its message, exit 1. With no corpus, prints `No corpus in data/eval. Run npm run eval:export first.` and exits 1.

- [ ] **Step 5: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: PASS. Manual check: in a scratch dir, write a 3-entry corpus with `writeCorpus`, run `npm run eval:label`, label one, press `q`, rerun, and confirm it starts at `[2/3]`.

- [ ] **Step 6: Commit**

```bash
git add lib/eval/label.ts scripts/eval-label.ts package.json tests/eval.test.ts
git commit -m "feat(eval): blind terminal labeling CLI"
```

---

### Task 5: Real-data eval command, committed report, README

**Files:**
- Create: `lib/eval/report.ts`
- Modify: `scripts/eval.ts` (add `--real` and `--report <path>`)
- Modify: `package.json` scripts (`"eval:real": "tsx scripts/eval.ts --real"`, `"eval:real:llm": "tsx scripts/eval.ts --real --llm"`)
- Modify: `README.md` ("Tests and eval" section; the "Storage" bullet)
- Test: `tests/eval.test.ts`

**Interfaces:**
- Consumes: `runEval`, `EvalResult`, `Rate` (Task 1); `loadLabeledCases`, `readCorpus`, `EVAL_DIR`, `CorpusKeyError` (Task 2).
- Produces:
  ```ts
  export interface ReportMeta { date: string; labeled: number; corpus: number; querySample: number; randomSample: number; model: string | null }
  export function formatRate(r: Rate): string; // "92.3% (85.1 to 96.4, n=130)" or "n/a (n=0)"
  export function formatReport(rules: EvalResult, llm: EvalResult | null, meta: ReportMeta): string;
  ```
- `formatReport` emits markdown: a title `# Subwatch extraction eval`, a methodology paragraph (one labeler who is the author, blind labeling, seeded sample, Wilson 95% intervals, `n` per cell, query sample vs random sample), a table with rows Relevance precision, Relevance recall, Kind accuracy, then precision and recall for Merchant, Amount, Date, Cancel link, then a line `Gmail query recall (random sample): ...`, and `Extraction paths: rules N, llm M` per column. Columns: Metric, Rules only, With LLM (`not run` when `llm` is null). It never reads `mismatches`.
- `scripts/eval.ts --real`: loads `.env.local`, `loadLabeledCases(EVAL_DIR)`; exits 1 with `No labeled emails in data/eval. Run npm run eval:export, then npm run eval:label.` when empty. Prints the same console summary as fixtures, mismatches included (terminal only). With `--report <path>` it runs rules-only always and with-LLM when `--llm` is set, then writes `formatReport` to `<path>`. `--report` without `--real` exits 1. `model` is `process.env.SUBWATCH_LLM_MODEL ?? "claude-haiku-5-5"` when `--llm`, else null.

- [ ] **Step 1: Write the failing tests**

```ts
it("formats rates and n/a", () => {
  expect(formatRate(rate(12, 13))).toBe("92.3% (66.7 to 98.6, n=13)");
  expect(formatRate(rate(0, 0))).toBe("n/a (n=0)");
});
it("report contains aggregate numbers only, no email content", () => {
  const cases = [mkCase({ relevant: true, kind: "receipt", merchant: "ZZMERCHANT", cancelUrl: "https://zz.example/cancel?t=SECRET" },
    { email: { id: "zz-id-1", from: "ZZ <a@zz.example>", subject: "ZZSUBJECT" } })];
  const r = scoreCases(cases, [mkPred({ merchant: "Other", cancelUrl: "https://zz.example/wrong" })]);
  expect(r.mismatches.length).toBeGreaterThan(0);
  const md = formatReport(r, null, { date: "2026-11-09", labeled: 1, corpus: 1, querySample: 1, randomSample: 0, model: null });
  for (const s of ["ZZSUBJECT", "ZZMERCHANT", "zz-id-1", "zz.example", "SECRET"]) expect(md).not.toContain(s);
  expect(md).toContain("| Relevance precision |");
  expect(md).toContain("not run");
  expect(md).not.toMatch(/\u2014/); // no em dashes
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/eval.test.ts`
Expected: FAIL, cannot resolve `../lib/eval/report`.

- [ ] **Step 3: Implement `lib/eval/report.ts`, the `scripts/eval.ts` flags, and the npm scripts.**

- [ ] **Step 4: Update `README.md`.** Replace the paragraph starting "The fixtures in `fixtures/emails.ts` are synthetic" with the real-data workflow: `npm run eval:export` (what it samples and why there are two samples), `npm run eval:label` (blind, resumable, roughly 30 to 60 seconds per email), `npm run eval:real` / `eval:real:llm`, `npm run eval:real -- --report docs/eval-results.md`, and `rm -rf data/eval` when done. Change the Storage bullet to add: "The optional eval corpus in `data/eval/` is the one exception: it stores sampled email bodies, encrypted with the token key, only when you run `npm run eval:export`." No em dashes.

- [ ] **Step 5: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run eval && npm run eval:real; echo "exit $?"`
Expected: tests pass; fixture eval unchanged; `eval:real` prints the "No labeled emails" message and `exit 1`.

- [ ] **Step 6: Commit**

```bash
git add lib/eval/report.ts scripts/eval.ts package.json README.md tests/eval.test.ts
git commit -m "feat(eval): real-data eval command and aggregate-only report"
```

---

## After the plan: running it on your inbox (manual)

Requires next step 2 (OAuth client created, Gmail connected via `npm run dev`).

1. `npm run eval:export` (about 220 emails).
2. `npm run eval:label` until done (about 2 to 3 hours total, resumable).
3. `npm run eval:real -- --report docs/eval-results.md`, then `npm run eval:real:llm -- --report docs/eval-results.md` if `ANTHROPIC_API_KEY` is set.
4. Read the mismatches in the terminal, fix rules if you want, rerun. Note in the report which numbers are before and after tuning: tuning on the same 200 emails makes them a training set, so quote the first run, or hold out 50 emails you never look at.
5. Commit `docs/eval-results.md`. Never commit `data/eval/`.
