# Supabase Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local single-owner model with Supabase Auth and Postgres so each user signs up, connects their own Gmail, and sees only their own data, and the app can be deployed.

**Architecture:** All persistence goes through one async `Store` interface with two implementations: `supabaseStore` (Postgres, scoped by row-level security to the signed-in user) and `memoryStore` (tests and demo mode, seeded with fixtures). Supabase Auth owns identity (email/password and Google); "Connect Gmail" stays the app's own `gmail.readonly` OAuth flow, with the refresh token encrypted by the existing AES-256-GCM helper and stored per user. `proxy.ts` refreshes the Supabase session and gates `/app` and `/api`.

**Tech Stack:** Next.js 16 (App Router, Cache Components, `proxy.ts`), `@supabase/supabase-js@2.119.0`, `@supabase/ssr@0.12.7`, `supabase` CLI 3.1.0 (migrations only, via `npx`), googleapis, Zod, Vitest. Removes `better-sqlite3`.

**Spec:** `docs/superpowers/specs/2026-11-10-supabase-accounts.md`

## Global Constraints

- Branch from `redesign` (its PR is not merged yet): `git checkout redesign && git checkout -b supabase-accounts`.
- Next.js 16 rules from `AGENTS.md`: read `node_modules/next/dist/docs/` before routes or data fetching; no `export const dynamic`; request-time reads (`cookies()`, Supabase calls) inside `<Suspense>` after `await connection()`; middleware is `proxy.ts`.
- Env vars (in `.env.local`, never committed): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only, used for account deletion and nothing else), `TOKEN_ENC_KEY` (64 hex, now required outside demo), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`.
- Every table has RLS enabled with the policy `auth.uid() = user_id` for select, insert, update and delete. No table is readable without a session.
- Gmail tokens are encrypted before they leave the server process. The browser never receives `enc_tokens`; no API route returns them.
- Demo mode (`DATA_SOURCE=fixtures`) uses `memoryStore` only, never Supabase, and is refused when `NODE_ENV === "production"`.
- Extraction (`lib/extract/*`) is unchanged; `npm run eval` output is unchanged.
- After each task: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` pass. No em dashes in UI copy. No paid services.

## Review Focus

1. A signed-in user calling Supabase directly from the browser with the public anon key cannot read or write another user's rows in any table. Test: Task 2, `tests/rls.integration.test.ts`.
2. An expired access token is refreshed by the proxy instead of bouncing the user to sign-in; a missing or invalid session redirects `/app/*` to `/signin` and returns 401 on `/api/*` mutations. Test: Task 3, `tests/auth.test.ts` gate cases plus manual check in Task 3 Step 6.
3. `npm run demo` with no Supabase env vars set renders every page and never constructs a Supabase client; demo in a production build is refused. Test: Task 1 `isDemo` cases, Task 4 Step 5.
4. Two users syncing at once get separate progress and never see each other's records. Test: Task 4, `sync progress is per user`.
5. A one-off purchase from a subscription merchant neither undoes "I've cancelled it" nor appears on the calendar as a subscription charge. Test: Task 1.

---

### Task 1: Store interface, memory store, demo guard, and the two carried-over fixes

**Files:**
- Create: `lib/store/types.ts`, `lib/store/memory.ts`
- Modify: `lib/resolve.ts` (manual-cancel comparison; receipts list), `lib/session.ts` (`isDemo` production guard only)
- Test: `tests/store.test.ts`, `tests/data.test.ts`

**Interfaces:**
- Produces, in `lib/store/types.ts`:
  ```ts
  export interface GmailConnection { gmailEmail: string; encTokens: string; lastSyncEpoch: number | null }
  export type MarkTable = "dismissed" | "manual_cancels" | "paid" | "reminders";
  export interface Store {
    userId: string;
    hasRecord(emailId: string): Promise<boolean>;
    saveRecord(r: ExtractedRecord): Promise<void>;
    loadRecords(): Promise<ExtractedRecord[]>;                 // ordered by emailDate ascending
    getGmail(): Promise<GmailConnection | null>;
    setGmail(c: GmailConnection | null): Promise<void>;        // null deletes the row
    marks(table: MarkTable): Promise<Map<string, string>>;      // key -> ISO time it was set
    setMark(table: MarkTable, key: string, on: boolean): Promise<void>;
  }
  ```
- Produces, in `lib/store/memory.ts`: `export function memoryStore(userId?: string): Store` (fresh, empty) and `export function demoStore(): Store` (process-wide singleton, `userId = "demo"`).
- Produces, in `lib/session.ts`: `isDemo(): boolean` is `process.env.DATA_SOURCE === "fixtures" && process.env.NODE_ENV !== "production"`; `DEMO_USER` unchanged. The HMAC session code stays until Task 3 replaces its callers.
- Produces, in `lib/resolve.ts`: `export function isRecurringReceipt(r: ExtractedRecord, sameMerchantReceipts: ExtractedRecord[]): boolean` (has a cadence, or its amount appears on 2+ receipts). `buildSubscription` and the `receipts: PastCharge[]` list both use it; the manual-cancel check compares against the newest recurring receipt.

- [ ] **Step 1: Write the failing tests**

`tests/store.test.ts`, a contract suite `describeStore(name, make: () => Store)` run here against `memoryStore` (Task 2 reuses it for Supabase):
```ts
it("saves, dedupes and orders records", async () => {
  const s = make();
  await s.saveRecord(rec("b", "2026-10-02T00:00:00Z")); await s.saveRecord(rec("a", "2026-09-01T00:00:00Z"));
  await s.saveRecord(rec("a", "2026-09-01T00:00:00Z"));
  expect((await s.loadRecords()).map((r) => r.emailId)).toEqual(["a", "b"]);
  expect(await s.hasRecord("a")).toBe(true);
});
it("sets, reads and clears marks per table", async () => {
  const s = make();
  await s.setMark("paid", "pge|2026-11-20", true);
  expect((await s.marks("paid")).has("pge|2026-11-20")).toBe(true);
  expect((await s.marks("reminders")).size).toBe(0);
  await s.setMark("paid", "pge|2026-11-20", false);
  expect((await s.marks("paid")).size).toBe(0);
});
it("stores and deletes the Gmail connection", async () => { /* setGmail(x) -> getGmail() equals x; setGmail(null) -> null */ });
it("keeps two memory stores apart", async () => { /* memoryStore("u1") saveRecord, memoryStore("u2").loadRecords() -> [] */ });
```
Demo guard: `isDemo()` is true for `DATA_SOURCE=fixtures, NODE_ENV=development`, false for `NODE_ENV=production`.

`tests/data.test.ts`, two new cases using the existing `rec()` helper:
```ts
it("a one-off purchase after 'I've cancelled it' does not bring the subscription back", () => {
  const order = rec({ emailDate: "2026-11-09T15:00:00Z", amount: 34.18, cadence: null });
  const d = buildDashboard([...netflix, order], { today: "2026-11-10", manualCancels: new Map([["netflix", "2026-11-08T10:00:00Z"]]) });
  expect(d.subscriptions.find((s) => s.merchantKey === "netflix")!.status).toBe("cancelled");
});
it("leaves one-off purchases off the calendar's past charges", () => {
  const order = rec({ emailDate: "2026-10-28T15:00:00Z", amount: 34.18, cadence: null });
  expect(buildDashboard([...netflix, order], { today: TODAY }).receipts.some((r) => r.amount === 34.18)).toBe(false);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/store.test.ts tests/data.test.ts`
Expected: store suite fails on the missing module; both new data cases fail on assertions.

- [ ] **Step 3: Implement `lib/store/types.ts`, `lib/store/memory.ts`, `isRecurringReceipt`, and the `isDemo` guard.** `demoStore()` seeds nothing itself; `runSync` fills it from fixtures on first load (Task 4).

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run eval`
Expected: all pass; eval unchanged. (`lib/db.ts` and the HMAC session stay in place until Tasks 3 and 4 replace their callers.)

- [ ] **Step 5: Commit**

```bash
git add lib/store lib/resolve.ts lib/session.ts tests/store.test.ts tests/data.test.ts
git commit -m "feat(store): Store interface and memory store; fix one-off receipts undoing cancels and inflating the calendar"
```

---

### Task 2: Supabase schema, RLS, and the Supabase store

**Files:**
- Create: `supabase/migrations/20261110000000_init.sql`, `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/store/supabase.ts`, `tests/rls.integration.test.ts`, `.env.example`
- Modify: `package.json` (deps; script `"test:db": "vitest run tests/*.integration.test.ts"`), `vitest.config.mts` (exclude `*.integration.test.ts` from `npm test`)

**Interfaces:**
- Consumes: `Store`, `GmailConnection`, `MarkTable` (Task 1); the contract suite from `tests/store.test.ts`.
- Produces:
  ```ts
  // lib/supabase/server.ts
  export async function supabaseServer(): Promise<SupabaseClient>; // @supabase/ssr createServerClient with cookies() getAll/setAll
  // lib/supabase/browser.ts
  export function supabaseBrowser(): SupabaseClient;                // createBrowserClient, anon key
  // lib/store/supabase.ts
  export function supabaseStore(client: SupabaseClient, userId: string): Store;
  ```
- Schema (one migration): tables `records (user_id uuid, email_id text, email_date timestamptz, data jsonb, primary key (user_id, email_id))`, `gmail_connections (user_id uuid primary key, gmail_email text not null, enc_tokens text not null, last_sync_epoch bigint)`, and `dismissed`, `manual_cancels`, `paid`, `reminders` each `(user_id uuid, key text, created_at timestamptz not null default now(), primary key (user_id, key))`. Every `user_id` is `not null references auth.users(id) on delete cascade`. Every table: `alter table ... enable row level security;` and one policy `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`.

- [ ] **Step 1: One-time setup (manual, recorded in README in Task 5)**

Create a free project at supabase.com. In Authentication > Providers keep Email on; for development turn off "Confirm email" (free tier sends few emails per hour). Copy the project URL and anon key into `.env.local`. Apply the migration in the SQL editor, or with `npx supabase@3.1.0 link` then `npx supabase@3.1.0 db push`. Create two test users in Authentication > Users and put `SUPABASE_TEST_EMAIL_A/B` and `SUPABASE_TEST_PASSWORD` in `.env.local`.

- [ ] **Step 2: Write the integration test** (`tests/rls.integration.test.ts`, skipped unless `NEXT_PUBLIC_SUPABASE_URL` and the test users are set)

Sign in A and B with the anon key in two clients. Run the Task 1 contract suite against `supabaseStore(clientA, A.id)` (clean A's rows in `afterEach`). Then:
```ts
it("user B cannot read or write user A's rows with the anon key", async () => {
  await storeA.saveRecord(rec("a1", "2026-10-01T00:00:00Z"));
  await storeA.setGmail({ gmailEmail: "a@x.com", encTokens: "enc", lastSyncEpoch: null });
  const { data } = await clientB.from("records").select("*").eq("user_id", A.id);
  expect(data).toEqual([]);
  expect((await clientB.from("gmail_connections").select("*")).data).toEqual([]);
  const ins = await clientB.from("paid").insert({ user_id: A.id, key: "x|2026-11-20" });
  expect(ins.error).not.toBeNull();
});
it("an anonymous client reads nothing", async () => { /* createClient(url, anon).from("records").select() -> [] */ });
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test:db`
Expected: FAIL on the missing `lib/store/supabase` module (or every case fails before the migration is applied).

- [ ] **Step 4: Implement the migration, `supabaseServer`, `supabaseBrowser`, `supabaseStore`.** `saveRecord` upserts on `(user_id, email_id)`; `marks` returns `key -> created_at`; `setMark(..., false)` deletes.

- [ ] **Step 5: Verify**

Run: `npm run test:db && npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: integration suite passes against the hosted project; offline suite unchanged.

- [ ] **Step 6: Commit** (`.env.example` lists every variable name with empty values)

```bash
git add supabase lib/supabase lib/store/supabase.ts tests/rls.integration.test.ts .env.example package.json package-lock.json vitest.config.mts
git commit -m "feat(db): Supabase schema with per-user RLS and a Supabase-backed store"
```

---

### Task 3: Supabase Auth: proxy, sign-in, sign-up, sign-out, current user

**Files:**
- Create: `app/auth/callback/route.ts`, `components/AuthForm.tsx`
- Modify: `proxy.ts`, `lib/gate.ts` (drop the `/api/auth/signout` special case only if sign-out moves client-side; keep it otherwise), `lib/current-user.ts`, `lib/route-auth.ts`, `app/signin/page.tsx`, `app/signup/page.tsx` (step 1), `app/api/auth/signout/route.ts`, `components/Account.tsx`
- Delete: from `lib/session.ts` the HMAC session (`createSessionToken`, `verifySessionToken`, `sessionFromCookie`, `sessionKey`, `SESSION_COOKIE`, `sessionCookieOptions`) and `checkOwner`, keeping `DEMO_USER` and `isDemo`; `deriveKey` in `lib/crypto.ts` if nothing else uses it; the owner logic (`owner_email`) wherever it remains. Replace the HMAC tests in `tests/auth.test.ts`.
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `supabaseServer`, `supabaseBrowser` (Task 2); `isDemo`, `DEMO_USER` (Task 1); `gate()` (unchanged signature).
- Produces:
  ```ts
  // lib/current-user.ts
  export interface AppUser { id: string; email: string; name: string }
  export async function getCurrentUser(): Promise<AppUser>;          // redirects to /signin when signed out; DEMO_USER (id "demo") in demo
  export async function getOptionalUser(): Promise<AppUser | null>;
  // lib/route-auth.ts
  export async function requireUser(req: Request): Promise<{ user: AppUser } | { denied: NextResponse }>; // same-origin check, then supabase.auth.getUser()
  // components/AuthForm.tsx
  export default function AuthForm({ mode }: { mode: "signin" | "signup" }): JSX.Element; // client; email+password, Google button, inline errors
  ```
- `name` is `user_metadata.full_name ?? user_metadata.name ?? email.split("@")[0]`.
- Proxy: create the Supabase client on the request/response cookie pair (the `@supabase/ssr` updateSession pattern), call `auth.getUser()` (refreshes an expired access token), then `gate()`. In demo mode skip Supabase entirely and treat as signed in.
- Sign-up collects name, email and password (minimum 8 characters, the existing "At least 8 characters." hint) and calls `auth.signUp({ email, password, options: { data: { full_name } } })`; on success it goes to `/signup?step=2`. Google uses `auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${APP_URL}/auth/callback?next=...` } })`; `/auth/callback` exchanges the code and redirects to a whitelisted `next` (`/app` or `/signup?step=2`), never a raw URL.
- Remove the "Coming soon" tags from both forms.

- [ ] **Step 1: Write the failing tests** (pure parts; Supabase calls are exercised manually in Step 6)

```ts
it("maps auth errors to plain copy", () => {
  expect(authErrorMessage("Invalid login credentials")).toBe("That email and password don't match.");
  expect(authErrorMessage("User already registered")).toBe("An account with that email already exists. Sign in instead.");
  expect(authErrorMessage("anything else")).toBe("Something went wrong. Please try again.");
});
it("only follows whitelisted next paths after the auth callback", () => {
  expect(safeNext("/app")).toBe("/app");
  expect(safeNext("/signup?step=2")).toBe("/signup?step=2");
  for (const bad of ["https://evil.example", "//evil.example", "/app@evil", "", null]) expect(safeNext(bad)).toBe("/app");
});
it("validates sign-up input", () => {
  expect(validateSignup({ name: "", email: "a@b.co", password: "12345678" })).toEqual({ name: "Enter your name." });
  expect(validateSignup({ name: "E", email: "nope", password: "short" })).toEqual({ email: "Enter an email address with an @.", password: "At least 8 characters." });
});
```
Export `authErrorMessage`, `safeNext`, `validateSignup` from `lib/auth-copy.ts` (move `AUTH_MESSAGES` there too). Keep the existing `gate()` tests.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/auth.test.ts`
Expected: FAIL, missing exports from `lib/auth-copy`.

- [ ] **Step 3: Implement `lib/auth-copy.ts`, `AuthForm`, `/auth/callback`, the proxy, `current-user`, `route-auth`, and sign-out** (`supabase.auth.signOut()` then 303 to `/signin?auth=signed_out`). Switch every `guardMutation(req)` caller to `requireUser(req)`.

- [ ] **Step 4: Enable Google in Supabase (manual).** Authentication > Providers > Google with the same Google client; add `https://<project>.supabase.co/auth/v1/callback` to the Google client's redirect URIs; in Supabase URL configuration set Site URL to `APP_URL` and add `${APP_URL}/auth/callback`.

- [ ] **Step 5: Verify automated checks**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 6: Verify by hand** on `npm run dev`: sign up with email, land on step 2; sign out; sign in with the wrong password (inline "That email and password don't match."); sign in with Google; open `/app` in a private window (redirects to `/signin`); `curl -X POST -H "Origin: http://127.0.0.1:3000" http://127.0.0.1:3000/api/sync` returns 401.

- [ ] **Step 7: Commit**

```bash
git add -A app components lib proxy.ts tests/auth.test.ts
git commit -m "feat(auth): Supabase sign-up, sign-in, Google and sign-out; proxy refreshes sessions"
```

---

### Task 4: Per-user data: Gmail connection, sync and pages on the Store

**Files:**
- Create: `lib/store/index.ts`
- Modify: `lib/gmail.ts`, `lib/sync.ts`, `lib/app-data.ts`, `app/api/auth/google/route.ts`, `app/api/auth/callback/route.ts`, `app/api/auth/disconnect/route.ts`, `app/api/sync/route.ts`, `app/api/dismiss/route.ts`, `app/api/cancelled/route.ts`, `app/api/bills/paid/route.ts`, `app/api/bills/reminder/route.ts`, `components/FirstScan.tsx` (no change expected), `tests/data.test.ts`, `tests/pipeline.test.ts` if it imports `lib/db`
- Delete: `lib/db.ts`, the `better-sqlite3` and `@types/better-sqlite3` dependencies

**Interfaces:**
- Consumes: `Store`, `memoryStore`, `demoStore` (Task 1); `supabaseServer`, `supabaseStore` (Task 2); `getCurrentUser`, `requireUser`, `AppUser` (Task 3).
- Produces:
  ```ts
  // lib/store/index.ts
  export async function storeFor(user: AppUser): Promise<Store>; // demoStore() in demo, else supabaseStore(await supabaseServer(), user.id)
  // lib/gmail.ts (token helpers now take the store)
  export async function connectGmailWithCode(code: string, store: Store): Promise<{ ok: true; gmailEmail: string } | { ok: false; reason: "no_identity" | "no_gmail" }>;
  export async function isConnected(store: Store): Promise<boolean>;
  export async function disconnect(store: Store): Promise<void>;          // revoke, then setGmail(null)
  export async function listIdsForQuery(store: Store, q: string, max: number): Promise<string[]>;
  export async function fetchEmail(store: Store, id: string): Promise<RawEmail | null>;
  // lib/sync.ts
  export async function runSync(store: Store, onProgress?: (p: SyncProgress) => void): Promise<SyncResult>;
  export function syncProgress(userId: string): SyncProgress;             // per-user map
  export async function getDashboard(store: Store): Promise<{ dashboard: Dashboard; source: DataSource; connected: boolean }>;
  export async function lastSyncedAt(store: Store): Promise<string | null>;
  ```
- The Gmail OAuth scope list stays `[gmail.readonly, openid, email]` (email shows which Gmail is connected; it may differ from the Subwatch account email). No owner check: the connection belongs to the signed-in Subwatch user.
- The sync cursor moves from kv `last_sync_epoch` to `gmail_connections.last_sync_epoch`; disconnecting deletes the row, so a reconnect rescans 13 months.
- One sync per user at a time: a module-level `Map<userId, Promise<SyncResult>>`; a second POST while one runs returns 409, and `getDashboard`'s demo first-load sync awaits the same promise instead of starting another.
- `scripts/eval-export.ts` keeps working for the developer by building a store for a user id given as `--user <uuid>` with the service role key; add that flag.

- [ ] **Step 1: Write the failing tests** (`tests/data.test.ts`, replacing the SQLite-based cases with Store-based ones)

```ts
it("sync progress is per user", async () => {
  const a = memoryStore("a"), b = memoryStore("b");
  await runSync(a);
  expect(syncProgress("a")).toMatchObject({ processed: 45, checked: 45 });
  expect(syncProgress("b")).toMatchObject({ listed: 0, processed: 0 });
  expect(await b.loadRecords()).toEqual([]);
});
it("a second sync for the same user while one runs is refused", async () => {
  const s = memoryStore("c");
  const first = runSync(s);
  await expect(runSync(s)).rejects.toThrow(/already running/);
  await first;
});
it("dashboard reads paid, reminders, dismissed and manual cancels from the store", async () => {
  const s = memoryStore("d");
  await runSync(s);
  await s.setMark("manual_cancels", "netflix", true);
  const { dashboard } = await getDashboard(s);
  expect(dashboard.subscriptions.find((x) => x.merchantKey === "netflix")!.status).toBe("cancelled");
});
```
(These run with `DATA_SOURCE=fixtures` set inside the test, as the existing progress test does; extend the test timeout to 15000 ms.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/data.test.ts`
Expected: FAIL, `runSync` does not accept a store.

- [ ] **Step 3: Implement `storeFor`, the Gmail and sync changes, and switch every route and `loadApp` to `getCurrentUser()` + `storeFor(user)`. Delete `lib/db.ts` and uninstall `better-sqlite3`.**

- [ ] **Step 4: Verify**

Run: `npm test && npm run eval && npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS; eval unchanged; `grep -r "better-sqlite3\|lib/db" app lib components scripts tests` finds nothing.

- [ ] **Step 5: Verify demo and real flows by hand**

With Supabase env vars removed from the shell, `npm run demo`: every page renders, sign-up step 2 uses the sample inbox, mark paid and "I've cancelled it" work. Then `npm run dev` with `.env.local`: sign up, Connect Gmail, step 3 shows real progress, the dashboard shows your data; a second account in a private window sees an empty dashboard until it connects its own Gmail.

- [ ] **Step 6: Commit**

```bash
git add -A app lib components scripts tests package.json package-lock.json
git commit -m "feat(data): per-user Gmail connection, sync and pages on Supabase; remove SQLite"
```

---

### Task 5: Account deletion, docs, and deploy

**Files:**
- Create: `app/api/account/delete/route.ts`, `lib/supabase/admin.ts`
- Modify: `components/Account.tsx` (a "Delete account" link opening a confirm dialog), `README.md` (Setup, Security model, Known limits), `app/page.tsx` privacy copy if it now overstates ("No email text stored" stays true)
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `storeFor`, `disconnect` (Tasks 3 and 4).
- Produces: `lib/supabase/admin.ts` `export function supabaseAdmin(): SupabaseClient` (service role key; throws if the key is missing; imported only by the delete route). `POST /api/account/delete` with body `{ confirm: "delete" }`: revokes Gmail, then `auth.admin.deleteUser(user.id)` (rows cascade), signs out, returns `{ ok: true }`.

- [ ] **Step 1: Write the failing test**

```ts
it("refuses account deletion without the typed confirmation", async () => {
  expect(DeleteBody.safeParse({ confirm: "delete" }).success).toBe(true);
  expect(DeleteBody.safeParse({ confirm: "yes" }).success).toBe(false);
  expect(DeleteBody.safeParse({}).success).toBe(false);
});
```
(`DeleteBody` exported from `lib/auth-copy.ts`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/auth.test.ts`
Expected: FAIL, missing export.

- [ ] **Step 3: Implement the route, `supabaseAdmin`, and the confirm dialog** (the user types `delete`; copy: "This deletes your Subwatch account and everything it found. Your Gmail is not touched.").

- [ ] **Step 4: Update `README.md`.** Replace "Connect your Gmail" with: Supabase setup (Task 2 Step 1 and Task 3 Step 4), Google Cloud setup with redirect URIs for both `/api/auth/callback` and the Supabase callback, `.env.local` from `.env.example`, `npm run dev`. Security model: RLS per user, tokens encrypted with `TOKEN_ENC_KEY`, service role key used only for deletion. Known limits: Google "Testing" mode allows up to 100 listed test users and expires refresh tokens after 7 days; public launch needs Google's restricted-scope verification.

- [ ] **Step 5: Deploy (manual checklist)**

Import the repo in Vercel; set every `.env.example` variable with `APP_URL` as the Vercel URL; add `${APP_URL}/api/auth/callback` to the Google client and `${APP_URL}/auth/callback` to Supabase redirect URLs; set Supabase Site URL to `APP_URL`. Sign up on the live URL, connect Gmail, and confirm the first scan finishes. If it times out, note your plan's function duration limit in README Known limits (sync already resumes from stored records on the next run).

- [ ] **Step 6: Verify and commit**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS.
```bash
git add -A app lib components README.md tests/auth.test.ts
git commit -m "feat(account): delete account, setup docs, deploy notes"
```
