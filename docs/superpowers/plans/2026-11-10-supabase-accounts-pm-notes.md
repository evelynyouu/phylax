# PM notes: Supabase accounts

Plan: docs/superpowers/plans/2026-11-10-supabase-accounts.md. Bank data is out of scope.

## 1. User acceptance checklist

### Task 1: Store, demo guard, two carried-over fixes
- [ ] `npm test` passes, including the new store and data cases (run `npm test`).
- [ ] `npm run demo` still shows every page with sample data and needs no Supabase or Google keys.
- [ ] In demo, mark a subscription "I've cancelled it": it stays cancelled even though a later one-off purchase from that merchant exists in the sample data.
- [ ] The calendar's past charges list does not show one-off purchases as subscription charges.
- [ ] `npm run eval` prints the same numbers as before.

### Task 2: Supabase schema, RLS, Supabase store
- [ ] After you apply the migration, Table Editor shows records, gmail_connections, dismissed, manual_cancels, paid, reminders, each with RLS enabled.
- [ ] `npm run test:db` passes with your two test users (user B cannot see or write user A's rows).
- [ ] `npm test` still passes offline (no network, no keys needed).
- [ ] `.env.example` lists every variable name with empty values, and `.env.local` is not tracked.
- [ ] `better-sqlite3` is still present until Task 4 (nothing breaks yet).

### Task 3: Auth (sign-up, sign-in, Google, sign-out)
- [ ] Sign up with name, email, password (8+ chars) lands on `/signup?step=2`; the "Coming soon" tags are gone.
- [ ] Wrong password shows "That email and password don't match." inline; an existing email shows the "already exists" message.
- [ ] "Continue with Google" signs you in and returns to the app.
- [ ] Opening `/app` in a private window redirects to `/signin`; Sign out returns to `/signin` with a signed-out notice.
- [ ] `curl -X POST -H "Origin: http://127.0.0.1:3000" http://127.0.0.1:3000/api/sync` returns 401 when signed out.

### Task 4: Per-user data and Gmail
- [ ] Connect Gmail (your own Google client) shows real scan progress on step 3, then your real subscriptions and bills.
- [ ] A second account in a private window sees an empty dashboard until it connects its own Gmail (no data from account 1).
- [ ] Disconnect removes the connection; reconnecting rescans.
- [ ] `npm run demo` with Supabase env vars unset still works end to end, and a production build refuses demo mode.
- [ ] `grep -r "better-sqlite3\|lib/db" app lib components scripts tests` finds nothing; `npm test`, `npm run eval`, `npm run build` pass.

### Task 5: Delete account, README, deploy
- [ ] Account menu has "Delete account"; the dialog needs typing `delete` and says your Gmail is not touched.
- [ ] After deleting, you cannot sign in again and the user is gone from Supabase Authentication > Users (rows cascade).
- [ ] README setup steps work from a clean clone when followed literally (Supabase, Google, `.env.local`, `npm run dev`).
- [ ] README names the Google "Testing" limits (100 test users, 7 day token expiry) and any Vercel timeout.
- [ ] Live Vercel URL: sign up, connect Gmail, first scan finishes.

## 2. Manual setup you do yourself (all free tiers, never add a card)

1. Create a Supabase project: supabase.com > Sign in > New project > Free plan, pick a region, save the DB password. Unblocks T2.
2. Copy keys: Project Settings > API. Put Project URL in `NEXT_PUBLIC_SUPABASE_URL`, anon key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, service_role key in `SUPABASE_SERVICE_ROLE_KEY` of `.env.local`. Also set `APP_URL=http://127.0.0.1:3000` and `TOKEN_ENC_KEY` (run `openssl rand -hex 32`). Never commit this file. Unblocks T2 (T4 needs TOKEN_ENC_KEY, T5 needs the service key).
3. Turn off email confirmation for dev: Authentication > Sign In / Providers > Email > switch off "Confirm email" > Save. Unblocks T3.
4. Apply the migration: SQL Editor > New query > paste `supabase/migrations/20261110000000_init.sql` > Run. Unblocks T2 tests.
5. Create two test users: Authentication > Users > Add user > Create new user, tick auto confirm. Add `SUPABASE_TEST_EMAIL_A`, `SUPABASE_TEST_EMAIL_B`, `SUPABASE_TEST_PASSWORD` to `.env.local`. Unblocks `npm run test:db` (T2).
6. Google Cloud client: console.cloud.google.com > New project > APIs & Services > Library > enable Gmail API > OAuth consent screen (External, Testing, add your own Gmail and any friends under Test users, add scope gmail.readonly) > Credentials > Create credentials > OAuth client ID > Web application. Authorized redirect URIs: `http://127.0.0.1:3000/api/auth/callback` and `https://<project-ref>.supabase.co/auth/v1/callback`. Put the ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Do not enable billing. Unblocks T3 (Google sign-in) and T4 (Connect Gmail).
7. Google in Supabase: Authentication > Sign In / Providers > Google > enable, paste the same client ID and secret > Save. Then Authentication > URL Configuration: Site URL `http://127.0.0.1:3000`, Redirect URLs add `http://127.0.0.1:3000/auth/callback`. Unblocks T3 Step 6.
8. Vercel (T5 only): vercel.com > Add New > Project > import the GitHub repo, Hobby plan. Add every `.env.example` variable, with `APP_URL` as your Vercel URL. Then add `<vercel-url>/api/auth/callback` in Google Cloud and `<vercel-url>/auth/callback` plus the Site URL in Supabase.

Costs nothing if you stay on free tiers. Watch for: Supabase free projects pause after about a week idle (Restore project in the dashboard); Vercel Hobby is non-commercial and has short function limits (scan may time out); Gmail API itself is free. Public launch needs Google verification of the restricted gmail scope, which can involve a paid security assessment: out of reach for now, so stay in Testing mode.

## 3. Product risks and gaps (most important first)

1. Signed-up user with no Gmail connected has no specified empty state; `/app` needs a plain "Connect Gmail to find your subscriptions" prompt, not a blank dashboard.
2. Google Testing mode expires Gmail tokens after 7 days; the plan has no "Gmail disconnected, reconnect" state, so data would look stale or empty with no explanation.
3. Users hit two Google consents (sign-in, then Connect Gmail) and may connect a different Gmail than their account email; copy should say why and show which Gmail is connected.
4. With email confirmation on in production, sign-up goes to step 2 with no session; there is no "check your email" state and no forgot-password flow.
5. First scan on Vercel may time out and leave step 3 looking stuck; it needs a "still working, you can come back" message and a retry.
6. Privacy copy: the app stores extracted merchants, amounts and dates (not email text) in Supabase; the landing page and README should say exactly that, and say Disconnect revokes access.

## Task 1 acceptance: ACCEPTED WITH NOTES
- Items 1, 3, 4, 5 met: 100 tests pass, both carried-over fixes have failing-then-passing tests, eval unchanged (45 emails, 100.0%).
- Item 2 (`npm run demo` renders every page) is not evidenced in the report; low risk since only resolve.ts and the isDemo guard changed, but click through demo once.
- The production demo refusal has a unit test; confirm it again in a real production build during Task 4 Step 5.
- Minors deferred (shared record references in memory store, duplicate-save order not in the contract, duplicated test helper) are acceptable, but fix the duplicate-save rule before Task 2 so Supabase upsert and memory store agree.
- Carried into Task 4: no-Gmail empty state, Reconnect Gmail state, step 2 copy on connected Gmail differing from account email.

## Task 2 acceptance: ACCEPTED WITH NOTES
- Met offline: `npm test` (101) and build pass with no keys; `.env.example` lists 11 empty names and is no longer gitignored; `.env.local` stays untracked.
- Not yet met: the checklist items that need your Supabase project (tables with RLS visible in Table Editor, `npm run test:db` passing). The live suite has never run, so isolation is reviewed but unproven.
- Do setup steps 1 to 5 now and run `npm run test:db` before Task 3; ask the controller to report the result here. Treat any failure as blocking.
- Risks to watch in the live run: `created_at` parsing, bigint to number for `last_sync_epoch`, and the 42501 error code on B's inserts.
- Fine as is: `test:db` uses its own config file (small deviation); tokens stay server-side; explicit grants plus revoke from anon is the safer choice.

Ruling (controller): Task 3 proceeds without the live run. Live `npm run test:db` (with the three risks above checked) is a hard gate before final review and merge.

## Task 3 acceptance: ACCEPTED WITH NOTES
- Met by evidence: "Coming soon" tags gone, `/app` redirects to `/signin` when signed out, signed-out POST `/api/sync` returns 401, sign-out goes to `/signin?auth=signed_out`, inline error copy is unit-tested. Demo still works.
- Not met yet (needs your project): real sign-up landing on step 2, wrong-password message from the real Supabase string, Google sign-in, and session refresh. Do setup steps 1 to 7 and run the Step 6 click-through before merge; it joins the live `test:db` run as a gate.
- Good: the "Check your email" state for confirmation-on projects covers my risk 4 in part (works only in the same browser; there is still no forgot-password flow, so note it in README Known limits).
- Branch still serves global data and Gmail tokens until Task 4: do not share or deploy it. Gmail now needs a signed-in user, so steps 2 and 3 of sign-up require a session.
- Use the same host in the browser, Supabase redirect list and Google URIs (127.0.0.1 vs localhost mismatch breaks Google sign-in); add this to the README.

## Live gate (Task 2 follow-up): PASSED for the database
- `npm run test:db` passes 16/16 on the real project after fixing a SQL syntax error in the policies (b07af50). Timestamps, bigint and 42501 are covered. Both migrations are applied.
- Still unproven live: email sign-up and sign-in click-through, Google sign-in, Gmail connect end to end (no Google client yet). These remain a pre-merge gate (setup steps 6 and 7).

## Task 4 acceptance: ACCEPTED WITH NOTES
- Met by evidence: SQLite gone (grep clean), demo works on every page with paid and cancel marks, production refuses demo (tested), 114 tests and eval unchanged, all three product states built (Connect Gmail empty state, Reconnect notice that survives reload, step 2 copy).
- Not yet seen by you: a real second account seeing an empty dashboard, real Gmail scan progress, and Disconnect then reconnect. Needs the Google client; do it before merge.
- Disconnect keeps stored records and switching to a different Gmail keeps the old one's records mixed in. Task 5 README (and the Disconnect dialog) should say plainly that Delete account is how you remove everything.
- With several serverless instances, scan progress can look stuck; keep the "still working, come back later" note on the Task 5 deploy list.
- Dev scripts (`eval:export` and others) now need `TOKEN_ENC_KEY` and `--user <uuid>`; confirm the README says so.

## Task 5 acceptance: ACCEPTED WITH NOTES
- Met by evidence: typed-confirmation dialog and route exist, delete is hidden and refused in demo, README has setup order, one-host rule, Disconnect vs Delete wording and Known limits; 115 tests, build pass.
- Not seen live: Delete account on a real user (confirm the user vanishes from Authentication > Users and cannot sign in again). Use a throwaway account, not your own.
- Not done: Vercel deploy, and the landing page privacy copy was not audited (check it says merchants, amounts and dates are stored, not email text).
- README: follow it literally from a clean clone once, as written, before calling it done.

## Release readiness (what you must still verify live)
Not ready to share or deploy until all of these pass on a real project:
1. Email sign-up lands on step 2; wrong password shows the plain message; sign-out and sign-in work.
2. Google sign-in (needs setup steps 6 and 7), then Connect Gmail with a real scan.
3. Two accounts in two browsers: account 2 sees an empty dashboard with the Connect Gmail prompt, never account 1's data.
4. Disconnect then reconnect; Delete account on a throwaway user.
5. Deploy last: Vercel env vars, both redirect URIs, sign up on the live URL, first scan finishes (or shows the come-back-later note).
Standing limits: Google Testing mode (about 100 test users, tokens expire after 7 days, Reconnect notice appears), no forgot-password, Supabase free project pauses when idle. Nothing here costs money.
