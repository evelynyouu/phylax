Draft for review. Not legal advice.

# Subwatch compliance gaps

Every place where the code, the README or the UI copy does not match the drafted policies or the rules they rest on. Ranked by risk. Evidence is `file:line` as read on 2026-11-11 around 00:50; another agent was editing code during this review, so recheck line numbers before fixing.

Risk means: **High** = likely to block Google verification, or a user-facing claim that is untrue or misleading about email data. **Medium** = a requirement that is missing or only partly met. **Low** = cleanup, wording, or good practice.

## Summary

| # | Risk | Gap | Status |
|---|---|---|---|
| H1 | High | AI fallback sends email text to Anthropic with no disclosure or consent, while the UI says email text is not stored | Fixed in 16d93d4 (fallback off for users) |
| H2 | High | No privacy policy, terms or Limited Use statement anywhere in the app | Open. Owner: frontend (pages, links), user (consent screen URLs, placeholders) |
| H3 | High | No disclosure immediately before Gmail consent on the in-app Connect and Reconnect buttons; the sign-up disclosure is incomplete | Open. Owner: frontend |
| H4 | High | A public launch with `gmail.readonly` needs restricted-scope verification and a CASA assessment; Testing mode only serves listed testers | Open. Owner: user |
| H5 | High | The eval export script can pull any user's mail with the service role key and print it for a human to read | Fixed in 16d93d4 (owner guard) |
| M1 | Medium | "Delete account removes everything" is not fully true | Server part fixed in 16d93d4. Rest: frontend |
| M2 | Medium | Privacy copy overstates what is read and saved | Minimization fixed in 16d93d4. Copy: frontend |
| M3 | Medium | No security headers | Baseline fixed in dd25609. Full CSP: frontend |
| M4 | Medium | Token key lives in an environment variable with no rotation support | Open. Owner: user |
| M5 | Medium | No contact or support channel in the app | Open. Owner: user (address), frontend (links) |
| M6 | Medium | Production sign-up depends on settings the README tells you to turn off for development (email confirmation, SMTP) | Open. Owner: user. The app's sign-up copy now handles both settings (cb81324) |
| M7 | Medium | No breach response plan (Google, state law) | Open. Owner: user |
| L1 to L10 | Low | See below | L1 server part and L2 fixed in 16d93d4; L3 moot; rest open |

Commits: cb81324 `fix(auth)` (redirect host, sign-up copy), 16d93d4 `fix(privacy)`, dd25609 `feat(security)`. Evidence line numbers below are from the original review; the fixed items name the code that changed.

---

## High

### H1. AI fallback sends email content to Anthropic, with no disclosure or consent

**Status: Fixed in 16d93d4** (option 1). `extractEmail` defaults `useLlm` to false (`lib/extract/index.ts`); sync and the demo never pass it, and only `scripts/eval.ts --llm` does (test: `tests/extract-llm-default.test.ts`, which stubs the LLM module and sets `ANTHROPIC_API_KEY`). The privacy policy draft now says no email goes to an AI service, and the Anthropic row is gone from the sharing and retention tables. README tells you not to set `ANTHROPIC_API_KEY` in production. Fix 3 (marking AI rows) is moot while the fallback is off for users.

**Evidence**
- What is sent: date, `From`, `Subject`, first 6,000 characters of body text and up to 3,000 characters of link text and URLs (`lib/extract/llm.ts:73-84`), to the Anthropic API (`lib/extract/llm.ts:88-93`).
- When: automatically during every sync when `ANTHROPIC_API_KEY` is set and the rules score a billing email below 0.7, or an unclassified email has a billing signal (`lib/extract/index.ts:12-25`, called from `lib/sync.ts:125-127`). There is no per-user switch.
- UI copy: "Subwatch can't ... Store the text of your emails" (`app/signup/page.tsx:104-107`); "No email text stored" (`app/page.tsx:150-151`); "It never stores the text of your emails" (`components/ConnectGmail.tsx:29`); "built to read as little as it can and keep even less" (`app/page.tsx:142`). None of them mention Anthropic or AI. README mentions the fallback only in developer sections (`README.md:36`, `:71`).
- Anthropic keeps API inputs and outputs for up to 30 days, and up to 2 years if flagged under its usage policy ([Anthropic retention](https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-personal-data)). So "never stores" is literally about Subwatch's database, but a copy does leave and is kept elsewhere.

**Rules**
- Transfers of Workspace data are allowed only "to provide or improve your appropriate use case or user-facing features ... and only with the user's consent"; the disclosure "Must explain how the data will be used and/or shared" ([Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)).
- Privacy policy and in-product notices "must thoroughly disclose the manner in which your application accesses, uses, stores, or shares Google user data" ([User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)).
- FTC Act section 5 bans "unfair or deceptive acts or practices" ([15 U.S.C. 45](https://www.law.cornell.edu/uscode/text/15/45)); the FTC has said leaving out material facts about data use can be deceptive and that "There is no AI exemption from the laws on the books" ([FTC, AI companies and privacy commitments](https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2024/01/ai-companies-uphold-your-privacy-confidentiality-commitments)).
- Training is not the issue: "Anthropic may not train models on Customer Content from Services" ([Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms)), which fits Google's ban on training non-personalized models ([Verification FAQ](https://support.google.com/cloud/answer/13463817)).

**Fix (pick one)**
1. Simplest: do not set `ANTHROPIC_API_KEY` in production. Keep the fallback for local eval only. Delete the Anthropic section from the privacy policy draft.
2. Or make it opt-in: add a per-user setting (default off), check it in `extractEmail` before calling `extractWithLlm`, show it in the pre-consent disclosure (H3) with exactly what is sent and Anthropic's retention, and change the copy to: "Subwatch doesn't save the text of your emails. If you turn on AI reading, some billing emails that the rules can't read are sent to Anthropic to pull out the amount, date and link. Anthropic doesn't train on them and deletes them within 30 days."
3. Either way, mark AI-extracted rows in the UI (records already carry `method: "llm"`, `lib/extract/llm.ts:142`) so users know to check them (see L3).

### H2. No privacy policy, terms or Limited Use statement in the app

**Status: Open.** Owner: frontend (publish `/privacy` and `/terms`, link them), user (consent screen URLs, fill the placeholders).

**Evidence**
- "Privacy" in the header and footer jumps to a marketing section on the same page (`app/page.tsx:37-39`, `app/page.tsx:183`). There is no `/privacy` or `/terms` route under `app/`.
- No Limited Use statement, no AI/ML statement, no retention or deletion explanation is visible to users anywhere.

**Rules**
- "You must publish a privacy policy that fully documents how your application interacts with user data" and list its URL in the OAuth client "when your application is made available to the public" ([User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)).
- The homepage must link the privacy policy, and that link must match the consent screen ([Verification requirements](https://support.google.com/cloud/answer/13464321)). It must be an HTML page on your own domain, not a template ([App Privacy Policy guide](https://support.google.com/cloud/answer/13806988)).
- An affirmative Limited Use statement must appear in the app or on its website ([Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)); suggested wording is in [Verification FAQ](https://support.google.com/cloud/answer/13463817).
- For AI/ML, the policy "must explicitly affirm that Google Workspace APIs are not used to develop, improve, or train non-personalized AI and/or ML models" ([App Privacy Policy guide](https://support.google.com/cloud/answer/13806988)).
- California's CalOPPA requires an operator of a "commercial" website that collects personal information from California residents to "conspicuously post its privacy policy", with categories collected, third parties, how changes are announced, an effective date and a Do Not Track disclosure ([B&P 22575](https://california.public.law/codes/business_and_professions_code_section_22575)); "operator" covers sites "operated for commercial purposes" ([B&P 22577](https://california.public.law/codes/business_and_professions_code_section_22577)). Whether a free student project counts as commercial is unverified; the draft policy meets the content list either way.

**Fix:** Publish `docs/legal/PRIVACY_POLICY.md` and `docs/legal/TERMS.md` as `/privacy` and `/terms` pages (plain HTML, no auth). Link them from the landing header and footer, sign-in, sign-up steps 1 and 2, and the app sidebar. Put the same URLs on the OAuth consent screen.

### H3. No disclosure immediately before Gmail consent on in-app paths; sign-up disclosure is incomplete

**Status: Open.** Owner: frontend. With the AI fallback off for users, the disclosure no longer needs to mention Anthropic.

**Evidence**
- In-app buttons go straight to Google: Connect (`components/ConnectGmail.tsx:29-33`), Reconnect (`components/ConnectGmail.tsx:45`), Connect after disconnect (`components/ConnectGmail.tsx:57`), all to `CONNECT_HREF` (`components/ConnectGmail.tsx:6`), which redirects to Google at once (`app/api/auth/google/route.ts:14-28`). The only text nearby is one line that also omits Anthropic (`components/ConnectGmail.tsx:29`).
- Sign-up step 2 has a "will / can't" list (`app/signup/page.tsx:90-111`) but does not say: that the sender, subject and body of every matching email from the last 13 months are read; that the Gmail message ID and a record for every scanned email (including non-billing ones) are saved; that some emails may go to Anthropic (H1); how long data is kept; or how to delete it. It does not link a privacy policy.

**Rules:** The disclosure must be in the app or "a separate dialog window if web-based", shown in normal use, give "clear and accurate information explaining the types of data being accessed", explain use and sharing, "Cannot be placed only in a privacy policy", and "must accompany and immediately precede a request for user consent", with affirmative user action ([Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)). Disclosures should be "prominent and timely" ([User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)).

**Fix:** Make one `GmailDisclosure` component and route every Connect and Reconnect button through it (for example a `/connect` page, or a dialog) with a "Continue to Google" button that then hits `/api/auth/google`. Content: what is read, what is saved (list the fields), who it is shared with (Supabase, Vercel, and Anthropic if on), retention, how to disconnect and delete, link to the privacy policy. Reuse it in sign-up step 2. If the disclosure changes in a way that affects Google data use, show it again before the next sync ([User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)).

### H4. Public launch with a restricted scope needs verification and a security assessment

**Status: Open.** Owner: user.

**Evidence:** `gmail.readonly` is requested (`lib/gmail.ts:10-11`). README already notes the Testing limits and that "a public launch needs Google's restricted-scope verification and security assessment" (`README.md:125-126`). The deploy checklist (`README.md` Deploy section) does not mention any of this.

**Rules:** `gmail.readonly` is restricted ([Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)). Apps that access restricted data "from or through a third-party server must go through a security assessment" (CASA), repeated "at least every 12 months" ([Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)). Unverified apps are capped at "100 new users in total" ([Unverified apps](https://support.google.com/cloud/answer/7454865)). Testing apps get 7-day refresh tokens ([OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)).

**Fix:** For a resume project, keep the Google app in Testing, list testers, and say on the landing page that Gmail connection is invite-only. Give everyone else a public sample-data demo. Note that demo mode is turned off when `NODE_ENV` is `production` (`lib/session.ts:5-7`), so a public demo needs a separate code path. If you do want a real public launch, follow `docs/legal/GOOGLE_VERIFICATION.md` Part B.

### H5. The eval export script can read any user's mail and show it to a person

**Status: Fixed in 16d93d4.** `scripts/eval-export.ts` refuses unless `--user` equals `EVAL_OWNER_USER_ID` (pure guard `evalOwnerError` in `lib/eval/export.ts`, tested in `tests/eval.test.ts`). Documented in README and `.env.example`. Not done: refusing the production Supabase URL without an explicit flag. Owner: user, if wanted.

**Evidence:** `scripts/eval-export.ts` takes any `--user <uuid>` (`scripts/eval-export.ts:28-35`) and reads that account's Gmail with the service role key (`scripts/eval-export.ts:50-53`), sampling about 220 emails including 60 from all mail, not just billing (`lib/eval/export.ts:27`, `:36-37`). The labeler prints sender, subject and body to the terminal for a human (`scripts/eval-label.ts:53-65`). README calls the service role key "never for request data" (`README.md:85`), which is true, but this is still a path for a person to read another user's mail.

**Rules:** "Do not allow humans to read user data, unless" the user gave documented explicit consent to view specific messages, or for security, legal compliance, or aggregated and anonymized internal use ([Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)). Developers must ensure "employees, agents, contractors, and successors comply" (same source).

**Fix:** Refuse to run unless `--user` equals an `EVAL_OWNER_USER_ID` env var that you set to your own account, and refuse when the Supabase URL is the production project unless you pass an explicit flag. Add a sentence to the privacy policy (already drafted under "Limited Use") that no person reads user email. Never run it against another user without written, message-specific consent.

---

## Medium

### M1. "Delete account removes everything" is not fully true

**Status: Server part fixed in 16d93d4.** `revokeBestEffort` now reports failure; Delete account and Disconnect still go ahead and answer `{ ok: true, revokeFailed: true }` (`tests/account-routes.test.ts`, `tests/gmail.test.ts`). README and the privacy policy draft point to https://myaccount.google.com/permissions. Copies at Anthropic no longer arise for users (H1). Account deletion with no service role key now answers plain JSON and changes nothing. Rest open, owner frontend: clear `subwatch.dismissed-attention` on delete and sign-out, show the permissions link when `revokeFailed` is true, and update the dialog copy. Supabase audit log retention: user.

**Evidence:** Delete dialog: "This deletes your Subwatch account and everything it found" (`components/DeleteAccount.tsx:58`); README: "removes everything" (`README.md:47`). The route revokes Gmail (best effort, errors swallowed: `app/api/account/delete/route.ts:19-24`, `lib/gmail.ts:140-150`) and hard-deletes the auth user, which cascades to all six tables (`app/api/account/delete/route.ts:26`; `supabase/migrations/20261110000000_init.sql:5`, `:13`, `:20`, `:27`, `:34`, `:41`). That part is good. What stays:
- the browser `localStorage` item `subwatch.dismissed-attention`, which holds merchant keys and dates (`components/AttentionList.tsx:7`, `:38`); it is not cleared on delete or sign-out;
- copies sent to Anthropic, for up to 30 days or longer if flagged ([Anthropic retention](https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-personal-data));
- Vercel runtime logs (1 hour on Hobby, [Vercel runtime logs](https://vercel.com/docs/logs/runtime)) and the `console.error` sync log (`app/api/sync/route.ts:21`);
- Supabase auth audit log entries, stored in log storage or optionally `auth.audit_log_entries` ([Supabase audit logs](https://supabase.com/docs/guides/auth/audit-logs)); whether they are removed with the user is unverified;
- the Google grant itself if revocation failed; the user is never told;
- any local eval corpus that included the user (H5).

**Rules:** Apps "must provide user help documentation that explains how users can manage and delete their data" ([Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)); the security assessment checks the ability "to delete user data upon a user's request" ([Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)); overclaiming deletion is a deception risk under FTC Act section 5 ([15 U.S.C. 45](https://www.law.cornell.edu/uscode/text/15/45)).

**Fix:** Clear `subwatch.dismissed-attention` (and any future `subwatch.*` keys) on delete and on sign-out. Make `revokeBestEffort` report failure, and if it fails show "Remove Subwatch at myaccount.google.com/permissions". Change the dialog copy to: "This permanently deletes your Subwatch account, your Gmail connection and everything Subwatch saved. Short-lived server logs, and any copies held by our AI provider, expire on their own within 30 days." Keep the retention table in the privacy policy accurate.

### M2. Privacy copy overstates what is read and what is saved

**Status: Minimization fixed in 16d93d4.** Sync now saves only `emailId`, `emailDate`, `kind`, `relevant`, `method` and `confidence` for non-billing emails, with every other field null (`lib/sync.ts` `recordToSave`, `tests/minimal-records.test.ts`). README "Storage" now matches. Rest open, owner frontend: the landing and sign-up copy.

**Evidence**
- "Only the merchant, amount, dates and cancel link from each billing email are saved" (`app/page.tsx:151`); "Save the merchant, amount, dates and cancel link" (`app/signup/page.tsx:99`); README the same (`README.md:73`). Actually saved per email: Gmail message ID, received date, kind, relevant flag, merchant, merchant key, amount, currency, cadence, due date, renewal date, cancel URL, link-trust flag, confidence and method (`lib/types.ts:27-43`, `lib/store/supabase.ts:19-25`).
- A record is saved for every email the scan processes, including ones classified as marketing or other (`lib/sync.ts:125-127`; non-relevant rules output at `lib/extract/rules.ts:243-262` and `:265-291`).
- "Subwatch only looks at billing emails" (`app/page.tsx:61`): the Gmail query matches subject keywords such as "your order" or "trial" (`lib/gmail.ts` `BILLING_QUERY`), so promotions are fetched in full too (`format: "full"`, body up to 20,000 characters).
- "Sign in with Google and grant read-only access" (`app/page.tsx:61`) blends sign-in (which grants no Gmail access) with the separate Gmail consent.

**Rules:** Privacy notices must be "accurate, comprehensive" ([User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)); FTC Act section 5 ([15 U.S.C. 45](https://www.law.cornell.edu/uscode/text/15/45)).

**Fix:** Change copy to "Subwatch saves only billing facts from each email (merchant, amount, billing cycle, dates, cancel link) and the email's ID so it is not read twice. It never saves the subject, sender or text." and "Subwatch searches for emails that look like billing and reads those." Optionally, for non-relevant emails store only ID and date (enough for dedup in `store.hasRecord`).

### M3. No security headers

**Status: Baseline fixed in dd25609.** `next.config.ts` sets `poweredByHeader: false` and, for every route, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; form-action 'self'`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`, plus `Strict-Transport-Security: max-age=63072000; includeSubDomains` in production (`tests/security-headers.test.ts`). Rest open, owner frontend: a full CSP (`default-src`, `script-src`, `style-src`, `connect-src` for Supabase, `img-src`) waits for the final frontend, since the current pages use inline styles and a WebGL canvas.

**Evidence:** `next.config.ts:3-15` has no `headers()`; `proxy.ts` sets only Supabase cookie headers. No Content-Security-Policy, `frame-ancestors` or `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` or `X-Content-Type-Options`. HSTS is added by Vercel automatically on `*.vercel.app`, and only for the specific subdomain on custom domains ([Vercel encryption and TLS](https://vercel.com/docs/security/encryption)).

**Rules:** Restricted-scope apps must follow CASA, and Google recommends being "free from common security issues as set out by the OWASP Top 10" ([Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)). The CASA checklist content itself was not read for this review (unverified which headers it tests).

**Fix:** Add in `next.config.ts` `headers()` for all routes: `Content-Security-Policy` (start with `default-src 'self'; frame-ancestors 'none'; connect-src 'self' https://<ref>.supabase.co; img-src 'self' data:; object-src 'none'; base-uri 'self'`, then adjust for Next.js scripts and the WebGL canvas), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` (or `no-referrer`, so cancel-link clicks do not leak paths), `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Read `node_modules/next/dist/docs/` first, as AGENTS.md requires, since this Next.js version may differ.

### M4. Token encryption key management

**Status: Open.** Owner: user.

**Evidence:** One static key from `TOKEN_ENC_KEY` (`lib/crypto.ts:11-17`); the ciphertext format has no key version (`lib/crypto.ts:32`), so rotating the key makes every stored token unreadable (they are then treated as revoked, `lib/gmail.ts` `makeClient`).

**Rules:** Required: "Keeping user data and credentials, specifically tokens such as OAuth access and refresh tokens, encrypted at rest" (met) and "Ensuring keys and key material are managed appropriately, such as stored in a hardware security module or equivalent-strength key management system" ([Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)). Vercel says environment variables are "encrypted at rest" ([Vercel environment variables](https://vercel.com/docs/environment-variables)); whether that counts as equivalent-strength is unverified.

**Fix:** For Testing, document the current setup and mark the variable as a Secret (write-only) in Vercel. Before verification, move to envelope encryption with a cloud KMS, and prefix ciphertext with a key ID (for example `v1.`) so keys can rotate.

### M5. No way to contact the developer

**Status: Open.** Owner: user (pick the address), frontend (links).

**Evidence:** No email, form or support link in `app/` or `components/` (searched for `mailto`, "contact", "support"). The footer has only Sign in, Privacy (anchor) and Style guide (`app/page.tsx:181-185`).

**Rules:** The consent screen needs a user support email and current developer contacts ([Verification requirements](https://support.google.com/cloud/answer/13464321)); CalOPPA requires describing how users can review and request changes, if such a process exists ([B&P 22575](https://california.public.law/codes/business_and_professions_code_section_22575)); the Workspace policy requires deletion help documentation ([Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)).

**Fix:** Add `[CONTACT EMAIL]` to the footer, privacy policy, terms and the app sidebar. Use a dedicated address, not a personal one.

### M6. Production sign-up depends on development-only settings

**Status: Open.** Owner: user (Supabase settings, SMTP). The app side is ready for confirmation on: Supabase's rate limit gets its own message, and an existing email is spotted from the empty `identities` answer (cb81324).

**Evidence:** README tells you to turn off Confirm email for development (`README.md:24`); the code handles both cases (`components/AuthForm.tsx:75-77`). There is no forgot-password flow (`README.md:123`).

**Rules and facts:** Supabase's built-in SMTP "is not meant for production use", only sends to project team addresses, and is rate limited ([Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)). With confirmation off, anyone can create an account under someone else's email address. Account emails are transactional, so CAN-SPAM's commercial-message rules mostly do not apply, but transactional messages still must not carry false routing information ([FTC CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)).

**Fix:** Before a public deploy, turn Confirm email on and configure a custom SMTP provider; add that provider to the privacy policy's sharing table. Add the production setting to the README Deploy checklist. Do not add marketing email without building CAN-SPAM opt-out handling.

### M7. No breach response plan

**Status: Open.** Owner: user.

**Evidence:** Nothing in the repo describes what to do if tokens, records or keys leak.

**Rules:** Google: notify `security@google.com` of any known or suspected unauthorized access, before any public statement ([Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)). All 50 states have breach notification laws ([NCSL](https://www.ncsl.org/technology-and-communication/security-breach-notification-laws)). California, for example, covers a person or business that "conducts business in California", counts "a username or email address, in combination with a password or security question and answer" as personal information, treats encrypted data as breached when the key is also taken, and sets notice "within 30 calendar days" ([Civ. Code 1798.82](https://california.public.law/codes/ca_civ_code_section_1798.82)); notices to more than 500 Californians go to the Attorney General ([CA AG](https://oag.ca.gov/privacy/databreach/reporting)). Whether an OAuth refresh token falls within any state's definition is unverified, and whether a free student project "conducts business" is unverified.

**Fix:** Write a one-page incident plan: rotate `TOKEN_ENC_KEY`, Google client secret, Supabase service role key and Anthropic key; delete all `gmail_connections` rows (forces reconnect, which also invalidates leaked tokens once revoked); revoke tokens at Google; email `security@google.com`; email affected users; check state notice rules.

---

## Low

| # | Gap | Evidence | Rule | Fix |
|---|---|---|---|---|
| L1 | **Server part fixed in 16d93d4** (Disconnect answers `revokeFailed`); UI copy open, owner frontend. Disconnect copy says access "is revoked", but revocation is best effort and failure is silent. Subwatch does delete its copy, so it loses access either way. | `app/page.tsx:147`, `components/DisconnectGmail.tsx:10`, `lib/gmail.ts:140-150`, `app/api/auth/disconnect/route.ts` | Accurate notices, [User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) | Return `{ revoked: false }` and tell the user to check myaccount.google.com/permissions |
| L2 | **Fixed in 16d93d4.** Sync failures were logged with the full error object; now `logError` (`lib/log.ts`) writes message and code only, in the sync and account delete routes | `app/api/sync/route.ts:21` | Treat data securely in logs ([Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)) | Log only `e.name`, a status code and a short message; confirm Google client errors do not include `Authorization` headers (unverified) |
| L3 | **Moot** while the AI fallback is off for users (H1). Users are not told AI output can be wrong | Records with `method: "llm"` look the same as rule results (`lib/extract/llm.ts:142`) | Anthropic Commercial Terms D.3: customer "must notify its Users, that factual assertions in Outputs should not be relied upon without independently checking their accuracy" ([terms](https://www.anthropic.com/legal/commercial-terms)) | Keep Terms section 3; add a small "Read by AI, check the email" note on those rows (only matters if H1 option 2) |
| L4 | Open, owner frontend. No age statement at sign-up | `components/AuthForm.tsx:130-158` | COPPA covers general-audience operators only with actual knowledge of under-13 users; operators may block children if they choose ([FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), [16 CFR 312.2](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312)) | Add "By creating an account you confirm you are 13 or older and agree to the Terms and Privacy Policy" with links |
| L5 | Open, owner user. Saved records are not app-encrypted | `records.data` jsonb (`supabase/migrations/20261110000000_init.sql:8`) | Encrypt user data "At rest on your systems" ([Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)); Supabase encrypts all data at rest with AES-256 ([Supabase security](https://supabase.com/security)), which likely satisfies this (unverified for CASA) | Document reliance on Supabase encryption; restrict dashboard access to you |
| L6 | Open, owner user; only matters if the AI fallback is ever on for users. Prompt-injection defenses exist but are not documented for reviewers | `lib/extract/llm.ts:8-13`, `:101-122` | Required: "Protecting against prompt injection techniques by either using Google Cloud Platform's Model Armor or other prompt injection protection" ([Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)) | Describe the defenses (no tools, schema, source-checked fields) in the verification submission |
| L7 | Open, owner user. Vercel Hobby has no DPA and is "non-commercial personal use only" | Hosting plan | Vercel DPA applies to Enterprise agreements ([Vercel DPA](https://vercel.com/legal/dpa)); Hobby limits ([Vercel Hobby](https://vercel.com/docs/plans/hobby), [fair use](https://vercel.com/docs/limits/fair-use-guidelines)); Supabase's terms incorporate its DPA for all customers ([Supabase terms](https://supabase.com/terms)) | Fine for a free student project; disclose Vercel under its privacy notice; upgrade before any monetization |
| L8 | Open, owner user. Google consent screen for sign-in shows `<ref>.supabase.co` | README step 2.3 redirect URI | Supabase "strongly recommended" a custom domain to reduce phishing confusion ([Supabase Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google)) | Custom domain or brand verification before launch |
| L9 | Open, owner user. Leftover local data | `data/subwatch.db` (+ `-wal`, `-shm`, 45 records, unused), `data/.token-key` | Minimize stored data ([User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)) | Delete when no longer needed; already gitignored (`.gitignore` `/data`) |
| L10 | Open, owner frontend. Accessibility issues in current components | See `docs/legal/ACCESSIBILITY.md` (input border contrast 1.58:1, mouse-only chart details, auto-moving birds) | WCAG 2.1 AA as benchmark ([WCAG 2.1](https://www.w3.org/TR/WCAG21/), [ADA.gov](https://www.ada.gov/resources/web-guidance/)) | Fix in the new frontend |

Checked and found fine: Gmail scope is the narrowest that provides message bodies (`lib/gmail.ts:10-11`); scopes are checked after consent (`lib/gmail.ts` `connectGmailWithCode`, `no_gmail`); tokens are encrypted with AES-256-GCM and a random IV (`lib/crypto.ts:27-33`); RLS on every table (`supabase/migrations/20261110000000_init.sql:47-87`); CSRF same-origin checks on state-changing routes (`lib/route-auth.ts`, `lib/csrf.ts`); OAuth `state` compared in constant time (`app/api/auth/callback/route.ts:7-11`, `:41`); open-redirect protection on callbacks (`lib/auth-copy.ts` `safeNext`, `app/api/auth/callback/route.ts:14`); cancel links require `https` and open with `noopener noreferrer` (`components/CancelAction.tsx:5-12`, `:37`); no analytics or ad trackers; sync error details are no longer sent to the browser (`lib/sync.ts:66`, `:111`).

---

## Which US laws plausibly apply

| Law | Applies? | Basis |
|---|---|---|
| FTC Act section 5 | **Yes.** Any misleading privacy or security claim is the main legal risk; this is why H1, M1 and M2 matter. FTC jurisdiction reaches "persons, partnerships, or corporations" acting "in or affecting commerce"; whether a free student project is "in commerce" is unverified, but it is the safe assumption. | [15 U.S.C. 45](https://www.law.cornell.edu/uscode/text/15/45), [FTC on AI privacy commitments](https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2024/01/ai-companies-uphold-your-privacy-confidentiality-commitments) |
| COPPA | **Only if** the site is directed to children or you gain actual knowledge of an under-13 user. Applies to "commercial websites and online services ... and not to nonprofit entities". Not child-directed, so: state 13+, delete any child account you learn about. | [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), [16 CFR 312.2](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312) |
| CCPA/CPRA | **Very likely no.** Applies to for-profit businesses doing business in California that have gross annual revenue of $26.625 million or more (effective January 1, 2025), or buy, sell or share personal information of 100,000 or more California residents or households, or get 50% or more of revenue from selling or sharing it. A free project with no revenue that does not sell or share data meets none of these. | [CPPA FAQ](https://cppa.ca.gov/faq.html), [CA AG CCPA](https://oag.ca.gov/privacy/ccpa) |
| Other state comprehensive privacy laws | Not checked one by one. They generally have user-count or revenue thresholds; applicability to this project is unverified. | n/a |
| CalOPPA | **Possibly.** Covers operators of websites "operated for commercial purposes" that collect personal information from California residents; requires a conspicuous privacy policy. Whether a free student project is commercial is unverified. The draft policy meets its content list. | [B&P 22575](https://california.public.law/codes/business_and_professions_code_section_22575), [B&P 22577](https://california.public.law/codes/business_and_professions_code_section_22577) |
| State breach notification laws | **Yes, in general terms.** All 50 states have them; details and definitions vary by state. | [NCSL](https://www.ncsl.org/technology-and-communication/security-breach-notification-laws), [Civ. Code 1798.82](https://california.public.law/codes/ca_civ_code_section_1798.82) |
| CAN-SPAM | **Mostly no.** The app sends no email of its own. Supabase sends account confirmation emails, which are transactional; CAN-SPAM's main rules cover commercial messages. | [FTC CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) |
| GLBA (Privacy and Safeguards Rules) | **Probably not, but not certain.** A "financial institution" is one "significantly engaged in financial activities" ([16 CFR 314.2](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-314/section-314.2)). Financial activities include data processing where "the data to be processed, stored or furnished are financial, banking or economic" ([12 CFR 225.28(b)(14)](https://www.ecfr.gov/current/title-12/chapter-II/subchapter-A/part-225/subpart-C/section-225.28)), which a subscription tracker could arguably touch. A free, non-commercial student project is unlikely to be "significantly engaged" in anything, and no source found addresses apps like this directly (unverified). If it became a business, get advice; the Safeguards Rule exempts institutions with customer information on fewer than 5,000 consumers from some (not all) requirements ([16 CFR 314.6](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-314/section-314.6)). | FTC overview: [GLBA](https://www.ftc.gov/business-guidance/privacy-security/gramm-leach-bliley-act) |
| ADA Title III | **Unsettled.** DOJ says the ADA applies to goods and services of public accommodations offered on the web but has no technical regulation for them; WCAG 2.1 AA is a legal standard only for state and local governments under Title II. See `docs/legal/ACCESSIBILITY.md`. | [ADA.gov web guidance](https://www.ada.gov/resources/web-guidance/), [Title II web rule](https://www.ada.gov/resources/2024-03-08-web-rule/) |
| Google API Services User Data Policy and Workspace policy | **Yes, contractually,** for any use of the Gmail API, in Testing or not. This is the strictest set of rules that applies. | [User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), [Workspace policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy) |

## Could not verify

- Whether a `*.vercel.app` subdomain passes Google's "verified domain you own" check, and whether `supabase.co` must be a verified authorized domain for Google sign-in.
- The exact Testing-mode test-user limit (README says 100; Google's pages confirm a 100 new-user cap for unverified apps and a "user cap" for Testing without a number).
- Which CASA tier and cost would apply to Subwatch, and which specific checks (such as headers) CASA tests.
- Whether a Vercel environment variable counts as "equivalent-strength" key management.
- Supabase free-plan log retention, internal backups, and whether auth audit entries are removed when a user is deleted.
- Whether Google API client errors redact tokens. No longer matters: the error object is never logged (L2).
- Whether federal courts treat web-only services as Title III public accommodations (circuits are known to disagree; not checked against primary sources here).
- Whether a free student project is "commercial" for CalOPPA or COPPA, or "conducts business" for breach laws.
