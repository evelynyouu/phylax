# Settings, Password Reset by Code, and Editable Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings page (photo, name, email change with verification, password, appearance, delete account), replace the reset link with a code-based "Forgot password" flow, and let users pick a category for every bill and subscription, with rules choosing one automatically.

**Architecture:** Categories become a per-user override table read into `buildDashboard`, so every `Subscription`, `DueItem` and `BillItem` carries a resolved `category`. Password reset uses Supabase's recovery OTP (`resetPasswordForEmail` then `verifyOtp({ type: "recovery" })`). Settings is a new `/app/settings` page in the app shell; profile photos live in a private Supabase Storage bucket and are shown through short-lived signed URLs.

**Tech Stack:** Next.js 16 (App Router, proxy.ts, Cache Components), React 19, Supabase Auth + Postgres RLS + Storage via `@supabase/ssr`, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-12-settings-reset-categories.md`

## Global Constraints

- No em dashes anywhere: copy, comments, commit messages.
- Plain, direct UI copy. Every user-facing string named in this plan is exact.
- Categorization is rules only. Nothing about a user's mail or merchants is sent to any outside service (spec decision). The AI fallback in `lib/extract/llm.ts` stays a local eval tool.
- Next 16: no `export const dynamic`; request-time reads go inside `<Suspense>` after `await connection()` (see `app/app/layout.tsx`).
- Every state-changing route starts with `requireUser(req)` (`lib/route-auth.ts`) and validates its body with Zod.
- New tables follow `supabase/migrations/20261111000001_subscription_edits.sql`: RLS on, `revoke all ... from anon`, grants to `authenticated`, one owner policy written `for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)`.
- App-shell styles use tokens from `app/globals.css` (they switch with dark mode), never new hex values, except fixed category fills.
- TDD: write each test, watch it fail, then implement. Baseline is 289 passing tests (`npm test`).
- Never print secrets. Don't commit `.env.local` or `data/`.

## Review Focus

1. A wrong, expired or already-used reset code: the person stays on the code step, sees "That code is wrong or has expired. Check the newest email or send a new code.", and can resend after a 60-second wait. Task 5 tests the message mapping and the cooldown.
2. An avatar that isn't really an image (a renamed file), is over 2 MB, or is HEIC from an iPhone: it's rejected with "Use a PNG, JPEG or WebP image under 2 MB." and nothing is uploaded. Task 6 tests the byte checks.
3. A category change sent with a bad merchant key or an unknown category: 400, nothing saved. A key with no record yet (a manual payment) still saves. Task 4 tests both.
4. An email change to the same address, or to one another account already uses: a clear message, no change. Task 7 tests `validateNewEmail` and the `email_exists` mapping.
5. A user who signed up with Google and has no password: Settings shows "Set a password" with no "Current password" field, and saving it lets them sign in with email later. Task 7 tests the render.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/categories.ts` | Category list, labels, order, `categoryFor` rules (Task 1) |
| `supabase/migrations/20261112000001_merchant_categories.sql` | Per-user category overrides table (Task 2) |
| `lib/store/{types,memory,supabase}.ts` | `listCategories`, `setCategory` (Task 2) |
| `lib/resolve.ts`, `lib/sync.ts`, `lib/types.ts` | Resolved `category` on dashboard items (Task 3) |
| `app/api/categories/route.ts` | Save or clear a category choice (Task 4) |
| `components/CategorySelect.tsx` | One select used in the edit panel and on Bills rows (Task 4) |
| `lib/password-reset.ts`, `components/ResetByCode.tsx`, `app/forgot-password/page.tsx` | Code-based reset (Task 5) |
| `supabase/migrations/20261112000002_avatars.sql`, `lib/avatar.ts`, `app/api/account/avatar/route.ts` | Profile photo storage (Task 6) |
| `lib/theme.ts`, `lib/profile.ts`, `components/settings/*`, `app/app/settings/page.tsx` | Settings page (Task 7) |
| `docs/legal/PRIVACY_POLICY.md`, `docs/legal/DATA_INVENTORY.md` | Disclose the photo and category data (Task 8) |

---

### Task 1: Category list and automatic rules

**Files:**
- Modify: `lib/categories.ts`, `app/globals.css` (category fill tokens), `components/ui.tsx` (`CAT_FILL`), `app/app/page.tsx` (`BAR` map), `components/RecurringView.tsx` (`ORDER`, `LABELS`)
- Test: `tests/categories.test.ts` (new); update `tests/views.test.ts` label expectation

**Interfaces:**
- Produces:
  - `type Category = "housing" | "utilities" | "phone" | "software" | "streaming" | "music" | "gaming" | "storage" | "shopping" | "learning" | "health" | "insurance" | "other"`
  - `CATEGORY_LABELS: Record<Category, string>`
  - `CATEGORY_ORDER: Category[]` (the label order below)
  - `isCategory(x: unknown): x is Category`
  - `categoryFor(merchantKey: string, merchantName?: string): Category`

Labels, in this order: housing "Housing and rent", utilities "Utilities", phone "Phone and internet", software "AI and technology", streaming "Streaming", music "Music", gaming "Gaming", storage "Storage", shopping "Shopping", learning "Learning", health "Health and fitness", insurance "Insurance", other "Other". The key `software` is kept so existing data and CSS still match. Only its label changes.

- [ ] **Step 1: Write the failing test** `tests/categories.test.ts`

```ts
it.each([
  ["spotify", "Spotify", "music"],
  ["netflix", "Netflix", "streaming"],
  ["openai", "ChatGPT Plus", "software"],
  ["maplepropertymanagement", "Maple Property Management", "housing"],
  ["rent", "Rent", "housing"],
  ["pge", "PG&E", "utilities"],
  ["tmobile", "T-Mobile", "phone"],
  ["comcast", "Comcast Xfinity", "phone"],
  ["nintendo", "Nintendo", "gaming"],
  ["steam", "Steam", "gaming"],
  ["xboxgamepass", "Xbox Game Pass", "gaming"],
  ["citygym", "City Gym", "health"],
  ["geico", "GEICO", "insurance"],
  ["acmecloud", "Acme Cloud", "other"],
])("categoryFor(%s, %s) is %s", (key, name, cat) => expect(categoryFor(key, name)).toBe(cat));
it("labels every category and orders all 13", () => {
  expect(CATEGORY_ORDER).toHaveLength(13);
  expect(CATEGORY_LABELS.software).toBe("AI and technology");
  expect(isCategory("gaming")).toBe(true);
  expect(isCategory("crypto")).toBe(false);
});
```

- [ ] **Step 2: Run, expect FAIL** `npx vitest run tests/categories.test.ts` (wrong categories, missing exports)

- [ ] **Step 3: Implement** in `lib/categories.ts`. Look up the exact key in the merchant map first (move `spotify` to music; add `pge`, `tmobile`, `verizon`, `att`, `comcast`, `xfinity`, `nintendo`, `steam`, `playstation`, `xbox`, `geico`, `progressive`, `statefarm`, `lemonade`, `peloton`, `classpass`, `strava`, `tidal`, `pandora`, `applemusic`). Then test keyword rules against `${merchantName} ${merchantKey}` lowercased, in this order:

```ts
const RULES: [Category, RegExp][] = [
  ["housing", /\b(rent|property|properties|apartments?|realty|leasing|landlord|hoa)\b|propertymanagement/],
  ["utilities", /\b(electric|power|energy|gas|water|sewer|utility|utilities|pg&e|edison)\b/],
  ["phone", /\b(wireless|mobile|cellular|internet|broadband|fiber|cable)\b|t-mobile/],
  ["gaming", /\b(xbox|playstation|psn|nintendo|steam|epic games|game pass|gaming|twitch)\b/],
  ["music", /\b(music|tidal|pandora|soundcloud)\b/],
  ["health", /\b(gym|fitness|yoga|peloton|health|clinic|dental|pharmacy)\b/],
  ["insurance", /\b(insurance|assurance|geico|allstate)\b/],
];
```

Then add `--cat-*` and `--bar-*` fills in `app/globals.css` for the seven new keys, using existing palette tokens where they fit and fixed hex only for new fills. Add the same keys to `CAT_FILL` (`components/ui.tsx`), `BAR` (`app/app/page.tsx`), and `ORDER`/`LABELS` in `RecurringView.tsx` (import `CATEGORY_ORDER`/`CATEGORY_LABELS` instead of local copies).

- [ ] **Step 4: Update** `tests/views.test.ts` "category totals" to expect `label: "AI and technology"`. Run `npm test`. Expected: all pass.

- [ ] **Step 5: Commit** `feat(categories): thirteen categories and keyword rules`

---

### Task 2: Category overrides in the store

**Files:**
- Create: `supabase/migrations/20261112000001_merchant_categories.sql`
- Modify: `lib/store/types.ts`, `lib/store/memory.ts`, `lib/store/supabase.ts`
- Test: `tests/store-contract.ts`, `tests/rls.integration.test.ts`

**Interfaces:**
- Consumes: `Category` (Task 1)
- Produces on `Store`: `listCategories(): Promise<Map<string, Category>>` (merchantKey to category) and `setCategory(merchantKey: string, category: Category | null): Promise<void>` (null deletes).

Table `public.merchant_categories(user_id uuid references auth.users on delete cascade, merchant_key text not null, category text not null check (category in (<the 13 keys>)), updated_at timestamptz not null default now(), primary key (user_id, merchant_key))`, with the Global Constraints RLS pattern.

- [ ] **Step 1: Add to `describeStore`** in `tests/store-contract.ts`: `it("sets, replaces, lists and clears category choices")`. Set netflix=music, then netflix=streaming, then gym=health; expect the map `{netflix: "streaming", gym: "health"}`; `setCategory("netflix", null)` leaves only gym. Add `"merchant_categories"` to the `tables` list and seeds (`{ merchant_key: "k", category: "music" }`, update `{ category: "gaming" }`, cross-user insert key `"bk"`) in `tests/rls.integration.test.ts`.
- [ ] **Step 2: Run** `npx vitest run tests/store.test.ts`. Expected: FAIL, `setCategory` is not a function.
- [ ] **Step 3: Implement** both stores. Supabase uses `upsert(..., { onConflict: "user_id,merchant_key" })` and filters by `user_id` like `saveEdit`. Write the migration.
- [ ] **Step 4: Run** `npm test`. Expected: pass. (`test:db` runs after the user applies the migration; see Task 8.)
- [ ] **Step 5: Commit** `feat(store): per-user category choices`

---

### Task 3: Every dashboard item carries its category

**Files:**
- Modify: `lib/types.ts`, `lib/resolve.ts`, `lib/sync.ts` (`getDashboard`), `lib/views.ts` (`categoryTotals`), `app/app/recurring/page.tsx` (`toRow`)
- Test: `tests/categories.test.ts` (add), plus the `sub()`/`due()` helpers in `tests/views.test.ts`, `tests/leaving-summary.test.ts`, `tests/deadline-rows.test.ts`, `tests/semiannual.test.tsx`, `tests/data.test.ts`

**Interfaces:**
- Consumes: `categoryFor` (Task 1), `Store.listCategories` (Task 2)
- Produces:
  - `Subscription.category: Category` and `Subscription.categoryChosen: boolean`
  - `DueItem.category: Category` and `BillItem.category: Category`
  - `buildDashboard(records, { ..., categories?: Map<string, Category> })`

- [ ] **Step 1: Write the failing test** `it("uses the user's category over the rules, for subscriptions and bills alike")`. Build a dashboard from the fixtures (`runSync(store, undefined, undefined, { source: "fixtures" })`). Set `categories: new Map([["netflix", "music"], ["pge", "housing"]])`. Expect Netflix `{ category: "music", categoryChosen: true }`, OpenAI `{ category: "software", categoryChosen: false }`, and the PG&E due item and bill item to have `category: "housing"`.
- [ ] **Step 2: Run, expect FAIL** (`category` undefined).
- [ ] **Step 3: Implement.** In `buildDashboard`, `const catOf = (key, name) => opts.categories?.get(key) ?? categoryFor(key, name)`, applied wherever subscriptions, due items and bills are built (including manual entries from `applyEdits`). `getDashboard` loads `store.listCategories()` with the same `.catch` fallback as `listEdits` (empty map). `categoryTotals` and `toRow` read `s.category` instead of calling `categoryFor`. Add `category: "other"` (and `categoryChosen: false` for subscriptions) to every test helper that builds these types by hand.
- [ ] **Step 4: Run** `npm test`. Expected: pass.
- [ ] **Step 5: Commit** `feat(categories): resolve each item's category, the user's choice first`

---

### Task 4: Change a category from Recurring and from Bills

**Files:**
- Create: `app/api/categories/route.ts`, `components/CategorySelect.tsx`
- Modify: `components/SubscriptionForm.tsx`, `components/RecurringView.tsx`, `components/BillsView.tsx`, `lib/views.ts` (`DeadlineRow.category`), `app/app/bills/page.tsx`, `app/pages.css`
- Test: `tests/category-route.test.ts` (new, mocking like `tests/subscription-edit-routes.test.ts`), `tests/subscription-form.test.tsx`, `tests/category-select.test.tsx` (new)

**Interfaces:**
- Consumes: `CATEGORY_ORDER`, `CATEGORY_LABELS`, `isCategory`, `Store.setCategory`, `DueItem.category`
- Produces:
  - `POST /api/categories` with body `{ merchantKey: string; category: Category | null }`, answering `{ ok: true }`
  - `<CategorySelect id: string; label: string; value: Category; onChange(c: Category) />`
  - `DeadlineRow.category: Category`

- [ ] **Step 1: Write failing tests.**
  - Route: saves for the signed-in user only. `category: null` clears it. 401 and 403 pass through. 400 for `merchantKey: "Bad Key!"` and for `category: "crypto"`. A key with no record (`"citygym"`) saves fine.
  - Form: the edit panel renders a select labeled "Category" with 13 options and the row's category selected.
  - Select: `renderToStaticMarkup(<CategorySelect id="c" label="Category for PG&E" value="utilities" .../>)` contains `aria-label="Category for PG&amp;E"` and `<option value="utilities" selected="">Utilities</option>`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
  - The route validates `merchantKey` with `/^[a-z0-9]{1,100}$/` and the category with `isCategory` or null.
  - `SubscriptionForm` gets a "Category" field, next to Next charge in a `form-pair` as in `design/pages/Subscriptions.dc.html`. Save posts to `/api/categories` only when the value changed. For a new manual payment, it posts after the edit call, using the returned `merchantKey`.
  - Bills: each row shows a compact `CategorySelect` under the name, labeled `Category for <merchant>`. Changing it posts right away, then `router.refresh()`.
  - Recurring groups re-sort on refresh. Errors use the existing `notice-bar warn`.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: pass.
- [ ] **Step 5: Commit** `feat(categories): change any bill or subscription's category`

---

### Task 5: Forgot password with a code

**Files:**
- Create: `lib/password-reset.ts`, `components/ResetByCode.tsx`, `components/ForgotLink.tsx`
- Modify: `app/forgot-password/page.tsx`, `components/AuthForm.tsx` (use `ForgotLink`), `lib/auth-copy.ts` (remove `/reset-password` from `NEXT_PATHS`; add codes), `proxy.ts` (drop `/reset-password` from the matcher)
- Delete: `app/reset-password/page.tsx`, `ResetForm` in `components/PasswordReset.tsx` (keep nothing from that file that only the link flow used)
- Test: `tests/password-reset.test.tsx` (new), update `tests/auth-redesign.test.ts`

**Interfaces:**
- Produces:
  - `cleanCode(raw: string): string` (strips spaces and dashes)
  - `isCodeShaped(code: string): boolean` (`/^\d{6,10}$/`)
  - `RESEND_SECONDS = 60`
  - `resetErrorMessage(code?: string | null): string`
  - `<ResetByCode initialEmail?: string />`
  - `<ForgotLink emailInputId: string />`

Copy, exact:
- Step 1 with a known email: heading "Reset your password", button "Send a verification email to {email}", link "Use a different email".
- Step 1 without one: field "Email", button "Send verification email".
- Step 2: "We sent a verification code to {email}. Enter it below." Field "Verification code" (`inputMode="numeric"`, `autoComplete="one-time-code"`), button "Verify code", and "Send a new code" (disabled with "Send a new code in {n}s" during the cooldown).
- Step 3: heading "Choose a new password", the password field and strength meter from sign-up, button "Save new password". Success goes to `/app`.
- Errors via `resetErrorMessage`: `otp_expired` gives "That code is wrong or has expired. Check the newest email or send a new code."; `over_email_send_rate_limit` gives "Too many emails were sent. Wait a minute and try again."; `same_password` gives "Choose a password you haven't used here before."; `weak_password` gives "Use at least 8 characters."; anything else falls back to `authErrorMessage`.
- Step 1 always advances to step 2, even if the address has no account, so the form can't be used to check which addresses exist.

- [ ] **Step 1: Write failing tests:**
  - `cleanCode(" 123-456 ")` is `"123456"`; `isCodeShaped` accepts 6 to 10 digits and rejects `"12345"` and `"12a456"`.
  - `resetErrorMessage("otp_expired")` gives the exact copy.
  - `renderToStaticMarkup(<ResetByCode initialEmail="a@b.co" />)` contains "Send a verification email to a@b.co".
  - `safeNext("/reset-password")` is now `"/app"`.
  - The `ForgotLink` markup has `href="/forgot-password"`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
  - `ResetByCode` calls `supabaseBrowser().auth.resetPasswordForEmail(email)` with no `redirectTo`.
  - It then calls `auth.verifyOtp({ email, token: cleanCode(code), type: "recovery" })`, which signs the person in.
  - Finally it calls `auth.updateUser({ password })` and `router.push("/app")`.
  - `ForgotLink` is a `<Link href="/forgot-password">` whose `onClick` reads the sign-in email input by id and, when it holds an `@`, navigates to `/forgot-password?email=<encoded>` instead.
  - The page reads `email` from `searchParams` inside `<Suspense>` and passes it as `initialEmail`.
- [ ] **Step 4: Run** `npm test`. Expected: pass.
- [ ] **Step 5: Commit** `feat(auth): reset a password with an emailed code`

---

### Task 6: Profile photo storage

**Files:**
- Create: `supabase/migrations/20261112000002_avatars.sql`, `lib/avatar.ts`, `app/api/account/avatar/route.ts`
- Modify: `lib/current-user.ts`, `app/api/account/delete/route.ts` (remove the photo, best effort), `components/Account.tsx` (show the photo), `app/app/layout.tsx`
- Test: `tests/avatar.test.ts` (new), `tests/account-routes.test.ts` (delete removes the photo)

**Interfaces:**
- Produces:
  - `AppUser` gains `avatarPath: string | null` (from `user_metadata.avatar_path`) and `providers: string[]` (`app_metadata.providers`, else `[app_metadata.provider]`).
  - `AVATAR_MAX_BYTES = 2 * 1024 * 1024`
  - `sniffImage(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null` (magic bytes, not the file name)
  - `avatarObjectPath(userId: string): string` (`${userId}/avatar`)
  - `avatarSignedUrl(client: SupabaseClient, path: string | null): Promise<string | null>` (1 hour, null on any error)
  - `POST /api/account/avatar` (multipart field `file`) answers `{ ok: true }`; `DELETE /api/account/avatar` answers `{ ok: true }`.

The migration inserts a bucket `('avatars', 'avatars', false, 2097152, '{image/png,image/jpeg,image/webp}')` and adds four `storage.objects` policies for `authenticated` (select, insert, update, delete), each limited to `bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text`.

- [ ] **Step 1: Write failing tests:**
  - `sniffImage` accepts real PNG, JPEG and WebP headers, and rejects a text file, a GIF and HEIC (`ftypheic`).
  - The route rejects over-size and non-image uploads with 400 and the exact copy "Use a PNG, JPEG or WebP image under 2 MB.", and never calls upload in those cases.
  - A valid upload uploads to `u1/avatar` with `upsert: true` and the sniffed content type, then sets `avatar_path` and an `avatar_updated` timestamp through `updateUser({ data })`.
  - DELETE removes the object and clears `avatar_path`.
  - Account delete removes `u1/avatar` through the admin client and still succeeds if that fails.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** with the request's own Supabase client (`supabaseServer()`), so storage RLS applies. In the layout, `AccountSlot` passes `avatarUrl` to `Account`, which renders `<img alt="" className="avatar">` when there is one and initials otherwise.
- [ ] **Step 4: Run** `npm test`. Expected: pass.
- [ ] **Step 5: Commit** `feat(account): profile photo upload`

---

### Task 7: The Settings page

**Files:**
- Create: `lib/theme.ts`, `lib/profile.ts`, `app/app/settings/page.tsx`, `components/settings/SettingsView.tsx`, `components/settings/ProfileSection.tsx`, `components/settings/EmailSection.tsx`, `components/settings/PasswordSection.tsx`, `components/settings/AppearanceSection.tsx`
- Modify: `components/NavLinks.tsx` (add Settings), `components/ThemeToggle.tsx` (use `lib/theme.ts`), `components/Account.tsx` (the name links to Settings; move Disconnect and Delete into Settings), `lib/auth-copy.ts` (`NEXT_PATHS` gains `/app/settings`), `app/pages.css`
- Test: `tests/settings.test.tsx` (new), `tests/legal.test.tsx` (sidebar still links Privacy and Terms under Sign out)

**Interfaces:**
- Consumes: `AppUser` with `providers` and `avatarPath` (Task 6), `avatarSignedUrl`, `passwordStrength`, `PasswordField`, `DeleteAccount`, `DisconnectGmail`
- Produces:
  - `type Theme = "light" | "dark"`, `readTheme(): Theme`, `applyTheme(t: Theme): void` (sets `data-theme`, saves `phylax-theme`, adds `theming` for 400 ms)
  - `validateName(raw: string): string | null` (error copy or null; trims; 1 to 80 characters; error "Enter a name up to 80 characters.")
  - `validateNewEmail(current: string, next: string): string | null` (needs an `@`; error "That is already your email." when it matches case-insensitively)
  - `hasPassword(user: AppUser): boolean` (`providers.includes("email")`)
  - `<SettingsView user, avatarUrl, gmailEmail: string | null />`

Page (`/app/settings`, title "Settings | Phylax", `page-head` heading "Settings"), one card per section, in this order:
1. **Profile:** photo or initials (64 px), "Upload photo", "Remove photo" (only when there is one), field "Name", button "Save name". Name saves with `supabaseBrowser().auth.updateUser({ data: { full_name } })` then `router.refresh()`.
2. **Email:** shows the current address.
   - For email-password users: field "New email" and button "Send verification". This calls `updateUser({ email }, { emailRedirectTo: origin + "/auth/callback?next=/app/settings" })`. On success it shows "We sent a confirmation link to {new}. Your email changes after you open it. Supabase may also ask you to confirm from your current address."
   - For Google-only users: "You sign in with Google, so your email comes from your Google account."
3. **Password:**
   - With a password: "Current password", "New password" with meter, button "Change password". It first checks the current password with `signInWithPassword({ email, password: current })` (`invalid_credentials` gives "Your current password is wrong."), then calls `updateUser({ password })`. Success shows "Password changed."
   - Without one: heading "Set a password", only "New password", button "Set password".
4. **Appearance:** a two-option radio group "Light" and "Dark" that calls `applyTheme`. The sidebar switch stays and both stay in sync, since both read `data-theme`.
5. **Gmail:** the connected address and the existing Disconnect, or "Gmail not connected" with a link to `/connect-gmail?next=app`.
6. **Delete account:** the existing `DeleteAccount` component and its copy.

- [ ] **Step 1: Write failing tests:**
  - `validateName("  ")` gives the error; `validateName("Evelyn You")` is null; 81 characters give the error.
  - `validateNewEmail("a@b.co", "A@B.co")` gives "That is already your email."
  - `authErrorMessage("", "email_exists")` gives the existing EXISTS copy.
  - `SettingsView` for an email user renders the headings Profile, Email, Password, Appearance, Gmail and Delete account, plus "Current password".
  - For a `providers: ["google"]` user it renders "Set a password" and no "Current password".
  - `NAV` includes `{ href: "/app/settings", label: "Settings" }`.
  - `safeNext("/app/settings")` is `"/app/settings"`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** The page reads `loadApp()` inside `<Suspense>` like the other `/app` pages, builds `avatarUrl` server-side, and renders `SettingsView`. Add a gear icon to `ICONS` in `NavLinks.tsx`.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit`, `npx eslint app components lib tests`, `npm run build`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(settings): profile, email, password, appearance and account settings`

---

### Task 8: Disclosures and setup steps

**Files:**
- Modify: `docs/legal/PRIVACY_POLICY.md`, `docs/legal/DATA_INVENTORY.md`, `README.md` (setup section)
- Test: `tests/legal.test.tsx` (the privacy page mentions the photo)

- [ ] **Step 1: Write the failing test:** the rendered privacy page contains "profile photo" and "category". DATA_INVENTORY lists `merchant_categories` and the `avatars` bucket.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Write the docs.**
  - Privacy policy: Phylax keeps an optional profile photo (private storage, deleted with the account or when removed) and the category the user picks for a merchant. Categories are chosen by rules on Phylax's own server; nothing goes to an outside service.
  - README setup: run the three new migrations in order.
  - Supabase Dashboard > Authentication > Email Templates > "Reset Password": the body must include the code `{{ .Token }}`, for example "Your Phylax code is {{ .Token }}. It expires in one hour." Remove the link.
  - Keep "Secure email change" on.
  - Rename any "Subwatch" in the templates.
- [ ] **Step 4: Run** `npm test`. Expected: pass.
- [ ] **Step 5: Commit** `docs: disclose profile photos and category choices; setup for codes`

**Manual steps for the owner (not code):** apply `20261112000000_semiannual_cadence.sql`, `20261112000001_merchant_categories.sql` and `20261112000002_avatars.sql` in the Supabase SQL editor, edit the Reset Password email template as above, then run `npm run test:db`.
