# Live end-to-end report, 2026-11-11

Production server at http://127.0.0.1:3000, real Supabase project, real Google OAuth client.
Headless Chrome via CDP, fresh profile per run. Requests to accounts.google.com were intercepted
and blocked after their URL was recorded, so no Google login was attempted. No secrets appear here;
client_id was compared in code against GOOGLE_CLIENT_ID.

Test user created: `e2e-1794436766@subwatch-e2e.test` (the first candidate domain was accepted;
mailinator.com was not needed).

Result: 7 PASS, 0 FAIL (two notes below).

## 1. Fresh sign-up through /signup: PASS
- Expected: with Confirm email off, the form lands on /signup?step=2 signed in, and step 2 shows the Gmail disclosure with a Privacy Policy link.
- Actual: after "Create account", the URL was `http://127.0.0.1:3000/signup?step=2`. Step 1 shows "(done)". The headings are "Connect Gmail", "Subwatch will", "Subwatch can't" and "Subwatch won't". The link "Read the Privacy Policy" points to `/privacy`. The Supabase auth-token cookie was set. No "Check your email" appeared, so Confirm email is off. The service role showed the user with `email_confirmed_at` set.
- The `subwatch-e2e.test` domain was accepted (no email_address_invalid).

## 2. Sign out, guard, sign in, wrong password: PASS
- Expected: the sign-out form lands on /signin, then /app redirects to /signin. Signing in with the right password lands on /app showing "Connect Gmail to get started". A wrong password shows "That email and password don't match."
- Actual: submitting the sign-out form went to `/signin?auth=signed_out` with "You're signed out." After that, /app redirected to `/signin`. A wrong password stayed on /signin with the alert "That email and password don't match." The right password went to `/app`, which shows "Gmail not connected", "E2E Tester" and "Connect Gmail to get started".

## 3. Connect Gmail redirect: PASS (note)
- Expected: /connect-gmail shows the disclosure. "Continue to Google" goes to /api/auth/google?next=app, which redirects to accounts.google.com with the correct parameters.
- Actual: /connect-gmail shows the disclosure (will / can't / won't). The link href is `/api/auth/google?next=app`. With the session cookie, GET returned **307** to `https://accounts.google.com/o/oauth2/v2/auth` with:
  - client_id: matches GOOGLE_CLIENT_ID
  - redirect_uri: `http://127.0.0.1:3000/api/auth/callback`
  - scope: `https://www.googleapis.com/auth/gmail.readonly openid email`
  - access_type=offline, prompt=consent, response_type=code, state present
  - Set-Cookie: oauth_state, oauth_next
- Clicking the link in the browser also reached accounts.google.com, with a matching client_id.
- Note: the status is 307 (NextResponse.redirect's default), not 302. Both are temporary redirects that a browser follows with GET, so this works as intended.

## 4. Google sign-in redirect: PASS
- Expected: clicking "Continue with Google" on /signin reaches accounts.google.com with a matching client_id, and redirect_uri is on the Supabase domain at /auth/v1/callback.
- Actual: the click led (through Supabase authorize) to `accounts.google.com/o/oauth2/v2/auth`. client_id matches GOOGLE_CLIENT_ID. redirect_uri's host equals the NEXT_PUBLIC_SUPABASE_URL host, with path `/auth/v1/callback`. scope is `email profile`. Supabase did not show an error page, so the provider is enabled.

## 5. Delete account through the app dialog: PASS (note)
- Expected: the response is {ok:true}, the user is signed out, /app redirects to /signin, signing in again fails, the auth user is gone, and all six tables have 0 rows for that user.
- Actual: the "Delete account" dialog opened with its submit button disabled. Typing `delete` enabled it. POST /api/account/delete returned 200 `{"ok":true,"revokeFailed":false}`. The browser went to `/` with no auth-token cookies left. /app then redirected to `/signin`. Signing in again showed "That email and password don't match."
- Service role: the auth user with that id no longer exists. records, gmail_connections, dismissed, manual_cancels, paid and reminders each have 0 rows for that id.
- Note: these tables also had 0 rows before the delete (no Gmail was connected, so nothing was synced). This run therefore does not show ON DELETE CASCADE removing real rows. It only shows that no rows remain.

## 6. Delete with the wrong confirm: PASS
- Expected: `{confirm:"yes"}` returns 400. Test user A is not deleted.
- Actual: signed in as test user A, a same-origin browser fetch returned 400 `{"error":"Type delete to confirm."}`. A Node request with the session cookie and Origin http://127.0.0.1:3000 also returned 400 with the same body. Afterwards A could still open /app, and A still exists.

## 7. Cleanup: PASS
- Users matching `e2e-<unix>@subwatch-e2e.test` or `e2e-<unix>@mailinator.com` before cleanup: 0 (the app's delete flow already removed the only one). After cleanup: 0. The service role deleted nothing.
- `e2e-signup-1794386389@example.com`: **does not exist** (read-only check; nothing was deleted).
- The local scratch files that held the generated password and cookies were removed.
