# What is left for you

Everything below needs your own accounts or decisions. The code side is done and tested (see "What was verified" at the end).

## 1. Turn on Gmail reading (about 15 minutes)

Follow README.md "2. Google Cloud" and docs/legal/GOOGLE_VERIFICATION.md Part A. In short:

1. Google Cloud Console: create a project, enable the Gmail API.
2. OAuth consent screen: External, publishing status Testing. Add your own Google account (and any testers) as test users. Declare the scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (Supabase's Google sign-in asks for these) and `.../auth/gmail.readonly` (Connect Gmail). Do not upload a logo yet (it can start brand verification).
3. Credentials: create an OAuth client ID, type Web application, with these redirect URIs:
   - `http://127.0.0.1:3000/api/auth/callback` (Connect Gmail)
   - `https://<your-project-ref>.supabase.co/auth/v1/callback` (Google sign-in)
4. Put the client ID and secret in `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Supabase: Authentication > Sign In / Providers > Google: turn it on with the same client ID and secret. Authentication > URL Configuration: Site URL `http://127.0.0.1:3000`, and add `http://127.0.0.1:3000/auth/callback` to the redirect URLs.

`APP_URL=http://127.0.0.1:3000` and `TOKEN_ENC_KEY` are already in your `.env.local`. Always open the app at http://127.0.0.1:3000, not localhost (one host everywhere).

## 2. Turn on account deletion

Supabase: Project Settings > API Keys: copy the **service_role** / **secret** key into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`. Never share it or commit it. Without it, "Delete account" shows "Account deletion is not available right now" and changes nothing.

## 3. Supabase email settings

The live test found "Confirm email" is still **on** in your project, and Supabase's free email sender hit its rate limit. For local testing, turn it off: Authentication > Sign In / Providers > Email > "Confirm email". For a public launch, keep it on and add your own SMTP provider in Supabase.

Also check Authentication > Users and delete `e2e-signup-1794386389@example.com` if it exists (the live test tried to create it).

## 4. Try every flow yourself (stop the demo server first; then `npm run dev`)

1. Sign up with email, sign out, sign in, wrong password.
2. Sign in with Google.
3. Connect Gmail, let the first scan finish, check the dashboard.
4. Cancel on Google's screen once, and untick the Gmail box once: you should land back with a clear message.
5. A second account in a private window: it sees "Connect Gmail to get started" and none of your data.
6. Disconnect Gmail (records stay, with a notice), then reconnect.
7. Delete a throwaway account.

## 5. Your frontend (tomorrow)

The new UI needs these to stay legal and honest (details in docs/legal/GAPS.md):

- `/privacy` and `/terms` already exist (plain styling) and render docs/legal/PRIVACY_POLICY.md and TERMS.md. Fill in every placeholder such as [CONTACT EMAIL] and [EFFECTIVE DATE], and delete the reviewer notes in TERMS.md: Google rejects template text. Restyle the pages in your frontend.
- The Gmail disclosure already exists at `/connect-gmail` and on sign-up step 2 (components/GmailDisclosure.tsx). Every Connect Gmail button must keep going through it.
- Landing copy must match docs/legal/DATA_INVENTORY.md exactly (what is stored).
- Show `revokeFailed` from Disconnect and Delete as "Remove Phylax at myaccount.google.com/permissions".
- Clear the `phylax.dismissed-attention` localStorage key on sign-out and delete.
- WCAG 2.1 AA: docs/legal/ACCESSIBILITY.md.
- A full Content-Security-Policy once the final scripts and styles are known (only frame-ancestors, base-uri and form-action are set now).

## 6. Before a public launch

- Have a lawyer read docs/legal/. These are drafts, not legal advice.
- Public use of `gmail.readonly` needs Google's restricted-scope verification and a yearly security assessment (docs/legal/GOOGLE_VERIFICATION.md Part B). Until then the app stays in Testing for listed test users.
- Deploy: README "Deploy" checklist (Vercel), with Supabase and Vercel in the same region.

## What was verified overnight

- 202 unit tests, typecheck, lint, production build; the extraction eval is unchanged.
- The full Google OAuth flow against a simulated Google (consent URL and scopes, state checks, every failure path, encrypted token storage per user, first scan, reconnect, switching Gmail with revoke). A real Google client is still needed for the live run (section 1).
- Live against your Supabase project: signing up with an email that already exists is detected and shows "already exists".
- Against your real Supabase project: the data-isolation suite (17/17): no user can read, add, change or delete another user's rows in any table; signed-out visitors read nothing.
- Live in a real browser on a production build: sign-in, wrong password, sign-out, signed-out redirects and 401s, cross-site requests refused (403), two real accounts isolated, no redirect can leave the site, security headers present.
- Not verified live (needs sections 1 to 3): Google sign-in, Connect Gmail and a real scan, a successful account deletion, a fresh sign-up end to end.
