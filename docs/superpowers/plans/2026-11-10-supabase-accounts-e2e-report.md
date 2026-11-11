# Subwatch account flows: live E2E report (2026-11-11)

Setup: scratch copy of branch `supabase-accounts` outside the repo, `next build` + `next start -H 127.0.0.1 -p 3200`, `APP_URL=http://127.0.0.1:3200`, no DATA_SOURCE, against the hosted Supabase project. No GOOGLE_CLIENT_ID/SECRET, no SUPABASE_SERVICE_ROLE_KEY. Browser flows ran in headless Chrome over CDP, with one isolated browser context per user. Port 3000 was not touched (it still answered 200 after cleanup).

Setup note: Turbopack would not build with a `node_modules` symlink that points outside the project root ("Could not find the Next.js package"), so the copy used an APFS clone (`cp -c`) of node_modules instead. The scratch copy has been deleted.

**Created user email (please check and delete):** `e2e-signup-1794386389@example.com`.
Supabase answered the sign-up with 429 `over_email_send_rate_limit`, so the user was probably never created. Please check Auth > Users anyway.

## Summary

| # | Test | Result |
|---|------|--------|
| 1 | Signed-out gating | PASS (the expected 403s come back as 401, see notes) |
| 2 | Sign-up lands on step 2, session cookie | BLOCKED by the Supabase email rate limit; step 2 content checked as user A: PASS |
| 3a | Duplicate sign-up message | FAIL (environment: the project still has "Confirm email" on) |
| 3b | Sign-up validation messages | PASS |
| 4 | Sign out | PASS (run as user A) |
| 5 | Sign in, wrong and right password | PASS |
| 6a | /api/auth/google with no Google client | PASS |
| 6b | GET /api/sync | PASS |
| 6c | POST /api/bills/paid | PASS |
| 6d | Delete account with confirm "delete" and no service role key | FAIL (500 with an empty body; A stays signed in: PASS) |
| 6e | Delete account with confirm "yes" | PASS |
| 7 | Isolation between A and B | PASS |
| 8 | Auth callback `next` hardening | FAIL (always redirects to `localhost:3200`, never to evil.example) |
| 9 | Session cookie readable from JS | INFO (readable; intended by the @supabase/ssr browser client) |
| 10 | Security headers | INFO (none present) |

Totals: 10 PASS, 3 FAIL (6d, 8, 3a; 3a is environment), 1 BLOCKED (2), 2 INFO.

## 1. Signed out

- Expected: GET /app and /app/bills redirect to /signin. POSTs with Origin `http://127.0.0.1:3200` return 401. POSTs with no Origin or a foreign Origin return 403, or whatever the code's order produces.
- Actual:
  - `GET /app` gives 307 to `http://127.0.0.1:3200/signin`. `GET /app/bills` gives 307 to `/signin`.
  - POST `/api/sync`, `/api/bills/paid`, `/api/cancelled`, `/api/dismiss`, `/api/account/delete` return 401 `{"error":"signed out"}` for same-origin, no-Origin and `https://evil.example` alike.
  - `GET /api/sync` gives 401. `GET /api/auth/google` gives 307 to `/signin`. `POST /api/auth/signout` with no Origin gives 403.
- Why the 401s: `proxy.ts` runs first and returns 401 for any signed-out `/api/*` request before the route's `sameOrigin` check runs. The routes' own order (403 first, then 401) only applies once a request is signed in. I checked that too, as user A, with A's cookies and no Origin or a foreign Origin: all six state-changing routes (`sync`, `bills/paid`, `cancelled`, `dismiss`, `account/delete`, `auth/disconnect`) returned 403 `{"error":"forbidden"}`.
- PASS.

## 2. Sign-up with a new email

- Expected: the form lands on `/signup?step=2`, step 2 shows the "any Gmail account" sentence, and an `sb-...-auth-token` cookie is set.
- Actual: the form stayed on `/signup` and showed "Something went wrong. Please try again." The network capture shows `POST <supabase>/auth/v1/signup` came back **429** `{"code":"over_email_send_rate_limit","msg":"email rate limit exceeded"}` with no session. No auth cookie was set.
- Supabase only sends an email on sign-up when Confirm email is on, so the project setting does not look switched off (test 3a points the same way).
- Step 2 content, checked as signed-in user A at `/signup?step=2`:
  - It shows "You can connect any Gmail account. It does not have to match the email you signed up with."
  - It shows the inline "Connecting Gmail is not set up yet..." line.
- Copy gap: the app maps the rate-limit error to the generic "Something went wrong. Please try again.", which does not tell the user to wait.
- BLOCKED (environment). The step 2 content PASSES.

## 3. Duplicate sign-up and validation

- 3a. Expected: "An account with that email already exists. Sign in instead."
  - Actual, signing up with existing user A's email: Supabase returned 200 with an obfuscated user and no session. The app showed "Check your email for a link to confirm your account. It brings you back here to connect Gmail." and the URL stayed `/signup`. Only PKCE code-verifier cookies were set.
  - Supabase returns `User already registered` only when Confirm email is off. With it on, Supabase hides whether the account exists.
  - FAIL (environment config, not app code). The app's mapping in `lib/auth-copy.ts` is correct for the confirm-off case.
  - The retry with the new email also returned 429 and showed the generic message.
- 3b. Expected: the three messages from `lib/auth-copy.ts`.
  - Actual: submitting name "", email "bad-email" and password "short" showed "Enter your name.", "Enter an email address with an @." and "At least 8 characters." The page stayed on `/signup` and made no network sign-up.
  - PASS.

## 4. Sign out (run as user A, since the new user could not be created)

- Expected: the sign-out form POST lands on /signin with the signed-out message, and /app then redirects to /signin.
- Actual:
  - Clicking the real `form[action="/api/auth/signout"]` button on `/app` landed on `http://127.0.0.1:3200/signin?auth=signed_out` showing "You're signed out."
  - All cookies for 127.0.0.1:3200 were cleared.
  - `/app` then went to `/signin`.
  - Replaying the old pre-sign-out cookie gave `/app` 307 to `/signin` and `GET /api/sync` 401, so the session is revoked on the server, not just cleared in the browser.
- PASS.

## 5. Sign in as user A

- Expected: a wrong password shows "That email and password don't match." The right password lands on /app, which shows "Connect Gmail to get started".
- Actual:
  - Wrong password: the page stayed on `/signin` and showed "That email and password don't match."
  - Right password: it reached `http://127.0.0.1:3200/app`, and the page contains "Connect Gmail to get started".
  - Visiting `/signin` while signed in redirects to `/app`.
  - The session cookie is `sb-<project-ref>-auth-token`: one chunk, httpOnly=false, secure=false, SameSite=Lax, path `/`, host 127.0.0.1, persistent.
- PASS.

## 6. Signed in as A

- 6a. `GET /api/auth/google` went to `http://127.0.0.1:3200/app?auth=not_configured`, which shows "Connecting Gmail is not set up yet...". With `?next=signup` it went to `/signup?step=2&auth=not_configured`, and the inline message is visible there. PASS.
- 6b. `GET /api/sync` returned 200 `{"running":false,"listed":0,"checked":0,"processed":0,"relevant":0,"error":null,"found":{"subscriptions":0,"bills":0}}`. The `error` key is null, and there are no tokens and no Gmail email. PASS.
  - Side note: a same-origin `POST /api/sync` with no Gmail connected returns 500 "Sync failed. Please try again." The server log shows the cause was the missing Google client. The message is fixed text, with no leak.
- 6c. `POST /api/bills/paid {"key":"pge|2026-11-20"}` returned 200 `{"ok":true}`. A bad key returned 400 `{"error":"bad request"}`. PASS.
- 6d. `POST /api/account/delete {"confirm":"delete"}` returned **500 with an empty body and no content-type**.
  - The server log shows `Error: SUPABASE_SERVICE_ROLE_KEY is required`. `supabaseAdmin()` throws, and the route does not catch it, so Next sends a bare 500 instead of the route's JSON "Could not delete your account. Please try again."
  - From reading `components/DeleteAccount.tsx` (not checked in the UI), the page falls back to that same sentence when the JSON parse fails, so a user would probably still see plain copy.
  - After the call, A kept the auth cookie and `/app` still loaded with "Connect Gmail to get started" (PASS).
  - API response: FAIL (minor).
- 6e. `{"confirm":"yes"}` returned 400 `{"error":"Type delete to confirm."}`. PASS.

## 7. Isolation (A and B in separate browser contexts, both signed in at once)

- Expected: after A marks a bill paid through the API, B sees nothing of A's on /app/bills or in GET /api/sync.
- Actual:
  - A marked `pge|2026-11-20` paid (200 ok).
  - B's header account title is B's email, not A's.
  - B's `/app/bills` shows no "pge" and no trace of A's email.
  - B's `GET /api/sync` shows all zeros, `error:null`.
  - Direct RLS probe, using each user's own access token against Supabase REST with the publishable key:
    - A's query `paid?key=eq.pge|2026-11-20` returned 1 row.
    - B's same query returned 0 rows. B reading all of `paid` returned 0 rows. B reading `gmail_connections` returned 0 rows.
  - The two access tokens are distinct.
- Cleanup: A posted `undo:true` (200 ok), and A's query then returned 0 rows.
- PASS.
- Caveat: A has no Gmail data, so the bills-page check is weak on its own. The RLS probe is the real evidence.

## 8. Auth callback hardening

- Expected: `/auth/callback?code=garbage` with `next=https://evil.example` or `next=//evil.example` never redirects off `127.0.0.1:3200`.
- Actual: every case returned 307 to **`http://localhost:3200/signin?auth=failed`**. That covers `next=https://evil.example`, `//evil.example` and `/\evil.example`, a missing code, and `error=x` (which gives `auth=denied`).
  - It never redirects to evil.example. The `safeNext` whitelist works.
  - But the host is always `localhost`, even with `Host: 127.0.0.1:3200`. Sending `Host: attacker.example` or `X-Forwarded-Host` also gave `localhost:3200`.
  - In `next start`, the route's `new URL(req.url).origin` comes out as `localhost`, despite the comment saying it stays on the request's host.
- Impact: a real Google sign-in or email-confirmation link opened on 127.0.0.1 would set the session cookies on 127.0.0.1 and then send the user to localhost, where those cookies do not exist, so they would land signed out. By contrast, `/api/auth/signout` and `/api/auth/google`, which use APP_URL, stayed on 127.0.0.1.
- FAIL (no open redirect; the problem is the host).

## 9. Session cookie and page JavaScript

- Expected: record what `document.cookie` shows (names only).
- Actual: `document.cookie` lists `sb-<project-ref>-auth-token` (httpOnly=false). Before a session exists, only the `...-code-verifier` cookies appear.
- This is intended: sign-in and sign-up run in the browser through `createBrowserClient`, which reads and writes the session cookie from JS.
- Consequence: any XSS could read the session, and there is no CSP to limit that (see 10).
- INFO.

## 10. Response headers

Checked on `/` (200), `/signin` (200), `/app` (307 signed out, 200 signed in) and `/api/sync` (401).

| Header | Present? |
|--------|----------|
| Content-Security-Policy | absent everywhere |
| X-Frame-Options | absent everywhere |
| Referrer-Policy | absent everywhere |
| Strict-Transport-Security | absent (expected over http) |
| Permissions-Policy | absent everywhere |
| X-Content-Type-Options | absent everywhere |

Other headers:
- `X-Powered-By: Next.js` is present on pages.
- Cache-Control is `private, no-cache, no-store, max-age=0, must-revalidate` on `/signin` and on signed-in `/app`, and `s-maxage=31536000` on `/`.

INFO.

## Not tested

- The real Google OAuth sign-in and Connect Gmail flows, beyond their error handling: there is no Google client.
- Successful account deletion: there is no service role key.
- A fresh sign-up end to end, including the step-2 landing and the session cookie of a new user: blocked by Supabase's 429 email rate limit.
- The duplicate-email copy in the confirm-off configuration.
