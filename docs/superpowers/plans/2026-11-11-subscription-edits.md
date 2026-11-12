# Subscription Edits and Manual Recurring Payments Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen by the user) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user fix any subscription the email reader got wrong (name, amount, cycle, next charge date), add recurring payments that have no email, and clean stray punctuation from merchant names.

**Architecture:** One per-user table `subscription_edits` keyed by `merchant_key` with nullable override fields and a `manual` flag. `buildDashboard` applies edits after building email subscriptions: an edit on an existing key overrides its fields; a `manual` row with no email subscription becomes a subscription of its own. Edits survive re-scans because they live outside `records`. "Not a subscription" reuses the existing Stop tracking (`dismissed`).

**Tech Stack:** Next.js 16, Supabase Postgres with RLS, Store interface, Zod, Vitest.

**Spec:** the user's requests in session, 2026-11-11: "clean up the comma", "give the ability to add recurring payments as well or edit stuff in the thing in case the email gets read wrong".

## Global Constraints

- Branch `supabase-accounts`. No em dashes. Product copy stays "Phylax".
- Every new table: `user_id uuid not null references auth.users(id) on delete cascade`, RLS enabled, policy `for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)` (FOR before TO), `revoke all ... from anon`, `grant select, insert, update, delete ... to authenticated`.
- Mutating routes use `requireUser(req)` (same-origin plus session) and Zod; logs via lib/log.ts only.
- Next 16 rules (AGENTS.md). UI changes minimal, reusing existing components and CSS; the user is redesigning the frontend.
- After each task: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run eval` (unchanged), and `npm run build` before the final review.

## Review Focus

1. A user cannot read or change another user's edits (RLS on the new table; live test).
2. Edits survive a re-scan and re-parse: records are rewritten, edits are not.
3. An edit with only some fields set overrides only those fields.
4. A manual entry whose name matches an email merchant does not create a duplicate subscription.
5. Invalid input (negative or huge amount, bad date, unknown cadence, overlong name) is rejected with 400.

---

### Task 1: Merchant name cleanup

**Files:** Modify `lib/extract/merchant.ts` (`cleanName`). Test `tests/pipeline.test.ts` (or a new test file).

- [ ] Test first: `cleanName("Myerhoff & Associates, .")` is "Myerhoff & Associates"; `cleanName("Acme, Inc.")` is "Acme"; `cleanName("A.B. Shop.")` is "A.B. Shop"; trailing and leading commas, periods, dashes and stray spaces are trimmed; internal punctuation is kept.
- [ ] Implement: after the existing steps, strip leading/trailing runs of `[\s,.;:\-]` (keep a trailing period only when it ends an abbreviation like "A.B."; simplest rule: strip trailing `,` `;` `:` `-` and a trailing `.` preceded by a space or comma).
- [ ] Verify the full suite and eval (merchant field must stay 100%).
- [ ] Commit `fix(extract): trim stray punctuation from merchant names`.

### Task 2: Edits table, Store methods, and resolve

**Files:** Create `supabase/migrations/20261111000001_subscription_edits.sql`. Modify `lib/store/types.ts`, `lib/store/memory.ts`, `lib/store/supabase.ts`, `lib/resolve.ts`, `lib/sync.ts` (getDashboard passes edits). Tests: `tests/store-contract.ts`, `tests/subscription-edits.test.ts`, `tests/rls.integration.test.ts`.

**Interfaces (produces):**
```ts
// lib/store/types.ts
export interface SubscriptionEdit {
  merchantKey: string;
  merchant: string | null;
  amount: number | null;
  currency: string | null;
  cadence: Cadence | null;
  nextChargeDate: string | null; // YYYY-MM-DD
  manual: boolean;
  updatedAt: string;
}
// Store
listEdits(): Promise<SubscriptionEdit[]>;
saveEdit(e: Omit<SubscriptionEdit, "updatedAt">): Promise<void>; // upsert on (user_id, merchant_key)
deleteEdit(merchantKey: string): Promise<void>;
// lib/resolve.ts buildDashboard opts
edits?: SubscriptionEdit[];
// Subscription gains
edited: boolean; manual: boolean;
```

- Migration: table `subscription_edits (user_id, merchant_key text, merchant text, amount numeric, currency text, cadence text check (cadence in ('weekly','monthly','quarterly','yearly')), next_charge_date date, manual boolean not null default false, updated_at timestamptz not null default now(), primary key (user_id, merchant_key))` plus the Global Constraints RLS block.
- [ ] Tests first (contract suite on memory store, and live via test:db once applied): save, list, upsert replaces, delete; two users isolated (extend the RLS loop to include `subscription_edits`).
- [ ] Tests first (`tests/subscription-edits.test.ts`, pure `buildDashboard`):
  - an edit with only `amount` on an existing subscription changes the amount, keeps cadence and dates, sets `edited: true`, recomputes `annualCost` and totals;
  - an edit with `nextChargeDate` replaces the next charge and the upcoming list;
  - a `manual` edit with merchant, amount, cadence and nextChargeDate and no records produces a subscription with `manual: true`, status active, in upcoming and totals;
  - a `manual` edit whose key matches an email subscription is applied as an override, not a second subscription;
  - an edit for a dismissed merchant key stays hidden;
  - a manual entry with no amount and no date is not listed (rule R1).
- [ ] Implement the Store methods, the resolve merge (apply after subscriptions are built and before totals and upcoming), and pass `edits` from `getDashboard`.
- [ ] Verify; commit `feat(subscriptions): per-user edits and manual recurring payments in the data layer`.

### Task 3: API routes

**Files:** Create `app/api/subscriptions/edit/route.ts` (POST upsert) and `app/api/subscriptions/edit/delete/route.ts` (POST delete). Test `tests/subscription-edit-routes.test.ts`.

- Body (Zod): `merchantKey` optional for manual (derived from `merchant` with the existing `merchantKey()` helper when absent), `merchant` 1..80 chars, `amount` 0 < x <= 100000 with at most 2 decimals or null, `currency` one of USD EUR GBP (default USD), `cadence` enum or null, `nextChargeDate` YYYY-MM-DD real calendar date or null, `manual` boolean. Delete body: `{ merchantKey }`.
- [ ] Tests first: signed out 401; foreign origin 403; invalid inputs 400 (each field); valid edit saves to the signed-in user's store only; manual add derives the key; delete removes.
- [ ] Implement with `requireUser`, `storeFor`, Zod. Verify; commit `feat(api): edit and add recurring payments`.

### Task 4: Minimal UI on Recurring

**Files:** Modify `components/RecurringView.tsx`, `app/app/recurring/page.tsx`. Create `components/SubscriptionForm.tsx`.

- An "Edit" button in the existing subscription panel opens `SubscriptionForm` prefilled (name, amount, cycle, next charge date), with Save, Cancel, and "Undo my edits" when `edited` (calls delete).
- An "Add a recurring payment" button in the Recurring page header opens the same form empty (manual).
- Manual and edited rows show a small Tag ("Added by you" / "Edited").
- Reuse `Field`, `Button`, `Tag`, existing dialog pattern and CSS. Errors shown inline from the route's 400 message. `router.refresh()` on success.
- [ ] Tests: render tests for the form's validation messages and that it posts the expected body (pure helper `toEditBody(form)` tested).
- [ ] Verify (build too); commit `feat(ui): edit subscriptions and add recurring payments`.

### After the tasks

- The user applies the new migration in the Supabase SQL editor (controller copies it to the clipboard); then `npm run test:db` live.
- Final whole-branch review on the most capable model; one fix pass; restart the app on port 3000.
