# Legal pages, Gmail disclosure and OAuth flow tests: report

Branch `supabase-accounts`, on top of 08ff037. Not pushed.

## Commits

- `ad1d2a7` feat(legal): privacy and terms pages and links
- `563925c` feat(privacy): disclosure before Gmail consent
- `b1ca135` test(oauth): end-to-end Google flow with a simulated Google

This report is left uncommitted.

## What changed

### 1. Privacy and Terms pages

- `lib/markdown.tsx` (new): a small Markdown renderer for what `docs/legal/*.md` use (`#`/`##`/`###`, paragraphs, `- ` lists, pipe tables, `---`, `**bold**`, `` `code` ``, `[text](url)`). It builds React elements, so React escapes all text and no raw HTML is injected. `publicLegalText` removes the "Draft for review. Not legal advice." line and the TERMS.md "Notes for the reviewer (delete before publishing)" section at the end. `legalDoc` reads the file with `fs.readFileSync`. The Next 16 caching guide says synchronous I/O finishes during prerender, so both pages build as static (`○ /privacy`, `○ /terms`).
- `app/privacy/page.tsx` and `app/terms/page.tsx` (new), framed by `components/LegalPage.tsx` (new). The frame reuses the sign-up layout classes `su`, `su-head`, `su-body`, `su-main` plus `stack-16`. No new CSS. The only inline style is `overflow-x: auto` around tables so they do not widen the page on a phone.
- Placeholders such as `[CONTACT EMAIL]` render exactly as written. One exception: a link whose href starts with `[APP URL]` (TERMS.md's `[Privacy Policy]([APP URL]/privacy)`) points to `/privacy` on this site. Link text and body text keep `[APP URL]`.
- "Last updated": PRIVACY_POLICY.md has its own line (`Last updated: [EFFECTIVE DATE]`), and it is rendered. TERMS.md has no Last updated line, only `Effective date: [EFFECTIVE DATE]`, and that line is rendered. I did not make up a date.
- Links:
  - `components/Account.tsx`: a `<p className="fine">` with Privacy · Terms under the Sign out row.
  - `app/signin/page.tsx`: a second `auth-foot` line with Privacy · Terms under "New to Phylax?".
  - `components/AuthForm.tsx` (sign-up mode only): "By creating an account you agree to the Terms and Privacy Policy." with links, under both the submit button and Continue with Google.
  - `app/page.tsx` footer only: the `#privacy` anchor now goes to `/privacy`, and Terms was added. The header's `#privacy` link is unchanged, as instructed.

### 2. Disclosure before Gmail consent

- `components/GmailDisclosure.tsx` (new) is the one place this copy lives: the "Phylax will / Phylax can't" block taken from sign-up step 2, the data paragraph, and the existing "You can connect any Gmail account" note. Both sign-up step 2 and `/connect-gmail` render it.
- `app/connect-gmail/page.tsx` (new): heading, lede, `<GmailDisclosure />`, then a Suspense child that runs `await connection()` and `getCurrentUser()` and renders "Continue to Google" plus "Read the Privacy Policy". The button links to `googleConsentHref(next)`, a new helper in `lib/auth-copy.ts`: `next=signup` stays `signup`, and anything else becomes `app`. It also shows the existing `GMAIL_MESSAGES.not_configured` line when Google is not configured, the same way step 2 does.
- Redirect for signed-out visitors: `redirect()` inside a streamed Suspense boundary only emits a client-side meta refresh (Next docs, `redirect.md`), so curl would see 200. To get a real 307 to `/signin`, `/connect-gmail` was added to the proxy matcher (`proxy.ts`) and to `gate()`'s sign-in list (`lib/gate.ts`). The page's `getCurrentUser()` is a second check.
- `components/ConnectGmail.tsx`: `CONNECT_HREF` is now `/connect-gmail?next=app`. This covers Connect Gmail on the empty state, Reconnect Gmail and the Disconnected notice. A grep found nothing else in `app/` or `components/` that linked to `/api/auth/google` except sign-up step 2, which still goes straight to `/api/auth/google?next=signup`.
- Checking the copy: I checked the requested paragraph against `docs/legal/DATA_INVENTORY.md` and the code. "Never sends email content to anyone" is not literally true. Email text is processed in Vercel function memory (DATA_INVENTORY section 2), and the fields Phylax keeps are saved in Supabase. GAPS.md H3 also asks the disclosure to say who data is shared with. So I changed that sentence and left the code alone. The final paragraph is:
  > Phylax keeps the merchant, amount, dates and cancel link it finds. It never stores the text of your emails and never uses them for ads or AI training. Your emails are processed only on Phylax's own server, hosted by Vercel. What Phylax keeps is saved in its database, hosted by Supabase. You can disconnect or delete your account at any time.

  Supporting evidence: no body, subject or sender is saved (`lib/sync.ts` `recordToSave`, `lib/types.ts`). The AI fallback is off for users (`lib/extract`, DATA_INVENTORY section 2). There are no analytics or ads (PRIVACY_POLICY section 6). Disconnect Gmail and Delete account are both in the sidebar (`components/Account.tsx`).

### 3. Simulated-Google OAuth tests

`tests/oauth-flow.test.ts` (24 tests) calls the real `app/api/auth/google/route.ts`, the real `app/api/auth/callback/route.ts`, and the real `lib/gmail.ts`, `lib/crypto.ts` and `lib/sync.ts`. Only these are faked:
- `getToken`, `verifyIdToken` and `revokeToken`, spied on `google.auth.OAuth2.prototype`. The consent URL comes from the real googleapis `generateAuthUrl`.
- global `fetch`, stubbed to throw, so any request that reaches the network fails the test.
- `getOptionalUser` and `storeFor`, mocked to a test user and per-user `memoryStore`s, the same way `tests/sync-route.test.ts` and `tests/account-routes.test.ts` do it.
- `next/server`'s `connection`, made a no-op because it needs Next's request scope.

What the tests cover:
- `/api/auth/google`: the redirect goes to `https://accounts.google.com/o/oauth2/v2/auth` with `response_type=code`, `access_type=offline`, `prompt=consent`, `include_granted_scopes=false`, scope exactly `gmail.readonly openid email`, `redirect_uri = APP_URL/api/auth/callback`, and a 48-hex state equal to the `oauth_state` cookie (HttpOnly, SameSite=Lax, Max-Age=600). The state differs on every call. Signed out goes to `/signin` with no cookie. Without `GOOGLE_CLIENT_ID` the user lands on `/app?auth=not_configured` or `/signup?step=2&auth=not_configured`.
- `/api/auth/callback` failures, each tested with `next=app` and `next=signup`: state mismatch, missing state cookie and missing code give `invalid_state`; `error=access_denied` gives `denied`; scopes without gmail.readonly give `no_gmail`; an id_token without email, or no id_token, gives `no_identity`. In every case the user lands on the right target, both users' stores stay empty, `oauth_state` and `oauth_next` are cleared, and the code is exchanged only where it should be. A signed-out callback goes to `/signin`.
- Happy path: the stored connection belongs only to the signed-in user. No token string appears in `encTokens`. An independent AES-256-GCM decryption with TOKEN_ENC_KEY (separate from `lib/crypto.ts`) returns the tokens, and a wrong key fails. `verifyIdToken` is called with the client id as audience. A sync over a fake `GmailLayer` with 6 fixture emails saves 6 records for that user, and no email body appears in them. The second user's store has no records and no connection. `next=signup` lands on `/signup?step=3`.
- Reconnect, same address in a different case: the cursor is kept, `needsReconnect` is cleared, the old refresh token is kept when Google sends none, and nothing is revoked. A different address: the cursor is reset and the old refresh token is revoked. If that revoke fails, the new connection is still stored.
- invalid_grant during sync is not repeated here. `tests/data.test.ts`, describe "Google refuses the token", already covers it in "when fetching mail: stops, deletes nothing, ..." and "when listing mail: same outcome".

## Reused code

- Layout and CSS classes: `su`, `su-head`, `su-body`, `su-main`, `lede`, `stack-16`, `fine`, `auth-foot`, `auth-msg`, `su-actions`, `btn btn-primary`, `will`, `muted`.
- `GMAIL_MESSAGES.not_configured` and `gmailFailureRedirect` from `lib/auth-copy.ts`, `getCurrentUser` and `getOptionalUser` from `lib/current-user.ts`, `gmailConfigured` from `lib/gmail.ts`, `isDemo`, `gate()` and the proxy matcher.
- The step 2 disclosure markup, moved unchanged into `GmailDisclosure`.
- Test helpers and patterns: `memoryStore`, the `GmailLayer` fake pattern from `tests/data.test.ts` and `tests/minimal-records.test.ts`, `FIXTURE_EMAILS`, the host-header `NextRequest` pattern from `tests/auth-routes.test.ts`, the env save and restore pattern from `tests/gmail.test.ts`, and `renderToStaticMarkup` as in `tests/ui.test.tsx`.

## Tests: RED and GREEN

- `tests/legal.test.tsx` (9 tests). The pages and renderer were written just before their tests, so their first run passed. To show those tests can fail, I broke the draft-line strip as a mutation: 3 failed / 6 passed, then all passed after restoring it. The link tests were written before the link edits. RED: 4 failed / 5 passed ("sit under Sign out", "sign-up agreement line", "sign-in footer", "landing footer"). GREEN after the edits: 9/9.
- `tests/gmail-disclosure.test.tsx` (6 tests). RED: `Cannot find module '../components/GmailDisclosure'` (no tests ran). GREEN: 6/6. It checks the required sentences, the `googleConsentHref` whitelist, `CONNECT_HREF`, and a grep over `components/` and `app/` (excluding `app/api` route handlers) showing only `app/connect-gmail/page.tsx` and `app/signup/page.tsx` reference `/api/auth/google` or `googleConsentHref`. It also checks that both pages use `<GmailDisclosure />` and that `/connect-gmail` is gated.
- `tests/oauth-flow.test.ts` (24 tests). This characterizes code that already existed, so the first run against the code was GREEN (after the harness fixes for `connection()` and the Host header). For RED evidence I ran temporary mutations, each reverted with `git checkout`:

| Mutation | Result |
|---|---|
| Callback skips the state comparison | 2 failed |
| Tokens stored as plaintext | 4 failed |
| `oauth_state` not cleared | 16 failed |
| No revoke when switching Gmail | 2 failed |
| gmail.readonly scope check removed | 2 failed |
| Cursor always reset on reconnect | 1 failed |
| `prompt: "consent"` dropped | 1 failed |

## Commands and output

- `npm test`: 21 files, 198 tests passed (was 168 before this work).
- `npm run eval`: 45 emails, rules 45. Relevance, kind, merchant, amount, date and cancel link are all 100.0%, identical to the earlier baseline (`eval-head.txt`). No extraction code changed.
- `npx tsc --noEmit`: clean. I ran `npx next typegen` once so `PageProps<"/connect-gmail">` resolves; it only writes under `.next`.
- `npm run lint`: clean.
- `npm run build`: success. `○ /privacy`, `○ /terms`, `◐ /connect-gmail`.
- Scratch production server: an APFS clone (`cp -c -R`) in the scratchpad, without `.next`, `.env.local`, `.git` or `data`. Supabase env vars were unset, so nothing contacted the live project. Built and started on 127.0.0.1:3200:
  - `/privacy`: 200, `<h1>Phylax Privacy Policy</h1>` and its h2s, 0 "Draft for review".
  - `/terms`: 200, `<h1>Phylax Terms of Use</h1>` and its h2s, 0 "Draft for review", 0 "Notes for the reviewer".
  - `/connect-gmail?next=app` signed out: `307` to `http://127.0.0.1:3200/signin`.
  - `/`: the footer contains `href="/privacy"` and `href="/terms"`.
  - The server was stopped (port 3200 then refused connections) and the clone deleted.

## Concerns

- The disclosure paragraph is worded differently from the brief, because "never sends email content to anyone" is not literally true (Vercel and Supabase). Please review the new wording.
- `/connect-gmail` was added to `proxy.ts`'s matcher and `gate()` so signed-out visitors get a real 307. That goes slightly beyond "page-level check only".
- TERMS.md has no "Last updated" line, so none is shown. Only "Effective date: [EFFECTIVE DATE]" appears. Add a line to TERMS.md if you want one.
- The TERMS.md reviewer notes are hidden from the public page by `publicLegalText`. Delete them from the file before publishing anyway.
- The public pages still show every placeholder (`[DEVELOPER NAME]`, `[EFFECTIVE DATE]`, `[APP URL]`, `[SUPABASE REGION]`, `[CONFIRM ...]` notes and others). Google verification will reject template text (GOOGLE_VERIFICATION.md B4), so fill these in before submitting.
- The landing header still has a `#privacy` anchor (left alone as instructed). GOOGLE_VERIFICATION.md B4 asks for the homepage to link the policy, and the footer now does.
- I could not render a signed-in `/connect-gmail` against a server without Supabase (demo mode is off in production builds). Its content is covered by the component and source tests, and its gating by curl.
- `docs/legal/GAPS.md` (H2, H3) and `GOOGLE_VERIFICATION.md` (A5, B4, B9) still list these items as open. I did not edit them.
- The legal pages read `docs/legal` at build time. They are static, so deploys need nothing at runtime, but if the build ever ran without `docs/`, those two pages would fail to build.
