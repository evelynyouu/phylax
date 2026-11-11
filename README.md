# Subwatch

Finds recurring charges, upcoming payments, and deadlines in your Gmail, and puts the cancel link from each company's own email next to the subscription.

- **Subscriptions:** merchant, amount, cadence, next charge, price changes, and a cancel link.
- **Coming up:** every expected charge over the next 60 days, including bills.
- **Deadlines:** bills to pay, free trials about to convert, renewals you can still stop.

## Try it without Gmail

```bash
npm install
npm run demo        # http://127.0.0.1:3000 with 45 sample emails
```

## Set up your own copy

Subwatch uses Supabase for accounts and storage, and Google for Gmail access.

### 1. Supabase

1. Create a project at supabase.com.
2. In Project Settings > Data API, copy the **Project URL**. Use the bare `https://<ref>.supabase.co`, not the `/rest/v1` address. In Project Settings > API Keys, copy the anon or publishable key. Put both in `.env.local` (see step 3).
3. For development, turn off **Confirm email** (Authentication > Sign In / Providers > Email), so new accounts can sign in at once.
4. In the SQL Editor, run both files in `supabase/migrations/`, in filename order: `20261110000000_init.sql`, then `20261111000000_gmail_needs_reconnect.sql`.
5. Only for `npm run test:db`: create two users in Authentication > Users with auto confirm on, then set `SUPABASE_TEST_EMAIL_A`, `SUPABASE_TEST_EMAIL_B` and `SUPABASE_TEST_PASSWORD` (the same password for both).

### 2. Google Cloud

1. Create a project and enable the **Gmail API**.
2. Configure the OAuth consent screen (External). Add the scope `.../auth/gmail.readonly` and add your own address as a test user.
3. Create an **OAuth client ID** of type Web application with two redirect URIs: `http://127.0.0.1:3000/api/auth/callback` (Gmail connection) and your Supabase callback, `https://<ref>.supabase.co/auth/v1/callback` (Google sign-in).

### 3. Environment

Copy `.env.example` to `.env.local` and fill it in. `TOKEN_ENC_KEY` is 64 hex characters: `openssl rand -hex 32`. `SUPABASE_SERVICE_ROLE_KEY` is used only to delete accounts and by the eval export script. `ANTHROPIC_API_KEY` is optional (LLM fallback for emails the rules cannot parse).

`APP_URL` must equal the exact host and port you open in the browser, for example `http://127.0.0.1:3000`. Use one host everywhere: either `127.0.0.1` or `localhost`, the same in `APP_URL`, every Google redirect URI, and the address you open in the browser. A mismatch breaks Google sign-in and Connect Gmail.

### 4. Run

`npm run dev`, open the address from `APP_URL`, sign up, and choose **Connect Gmail**. Step 3 of sign-up starts the first scan. After that, use **Sync now** on the dashboard to read new billing email.

### Disconnect and delete

- **Disconnect Gmail** revokes Subwatch's Gmail access but keeps the records it already found; the app keeps showing them with a notice to connect again. If you then connect a different Gmail address, its records are added alongside the old ones, and the old address's access is revoked.
- **Delete account** removes everything: your account and all saved records. Your Gmail itself is never touched.

### Deploy

This is a manual checklist; nothing here is automated.

1. Import the repo in Vercel. Pick the same region for Supabase and your host, so each database call stays short.
2. Set every variable from `.env.example`, with `APP_URL` set to the Vercel URL.
3. Add `${APP_URL}/api/auth/callback` to the Google OAuth client's redirect URIs.
4. Add `${APP_URL}/auth/callback` to Supabase Authentication > URL Configuration > Redirect URLs, and set the Supabase Site URL to `APP_URL`.
5. Sign up on the live URL, connect Gmail, and confirm the first scan finishes. If it times out, note your plan's function duration limit under Known limits (sync resumes from stored records on the next run).

## How it works

```
Gmail (read-only) -> sync -> rules extractor -> [low confidence] -> LLM fallback
                                  |                                      |
                                  +------------ records (Supabase) ------+
                                                       |
                                  entity resolution + recurrence detection
                                                       |
                                                   dashboard
```

- **Rules first.** Classification, amounts, dates, cadence, and cancel links come from patterns and a merchant table. The model only sees emails the rules score below 0.7, or that look billing-related but matched nothing.
- **Resolution.** Records are grouped by merchant. A merchant is a subscription when emails state a cadence, a renewal or trial notice exists, or charges repeat. One-off purchases are ignored. Cancelled subscriptions are detected from cancellation emails.
- **Storage.** Only the merchant, amount, dates, and cancel link from each email are saved, in the signed-in user's rows in Supabase (row level security keeps each account to its own data). Email text is not stored. The optional eval corpus in `data/eval/` is the one exception: it stores sampled email bodies, encrypted with the token key, only when you run `npm run eval:export`.

## Security model

Email is untrusted input.

- Gmail scope is `gmail.readonly`. The app cannot send, label, or delete mail.
- The LLM has no tools. Its output is one JSON object checked with a schema, and every date, amount, and URL it returns must appear in the source email or it is dropped.
- A sender whose display name is a known brand but whose domain is not (`Netflix <billing@netflix-account-support.co>`) is discarded as phishing.
- Cancel links must be `https`. A link on the sender's own domain opens directly. Any other domain shows a warning with the real hostname first.
- Sign-in is Supabase Auth. Row level security limits every table to the signed-in user's own rows.
- Gmail refresh tokens are encrypted with AES-256-GCM using `TOKEN_ENC_KEY`.
- The Supabase service role key bypasses row level security. It is used only to delete an account (and by the developer eval export script), never for request data.
- State-changing routes accept only same-origin requests and check the session. OAuth uses a random `state` cookie.

## Tests and eval

```bash
npm test            # unit tests, including prompt-injection and phishing cases
npm run eval        # extraction quality on the labeled fixtures
npm run eval:llm    # same, with the LLM fallback (needs ANTHROPIC_API_KEY)
```

The fixtures in `fixtures/emails.ts` are synthetic and were labeled and tuned by the author, so the score on them is a regression check, not a measure of real-world accuracy.

### Eval on your own inbox

Connect Gmail first (see above). The eval scripts need `TOKEN_ENC_KEY`; to read an existing `data/eval` corpus created before accounts were added, set `TOKEN_ENC_KEY` to the contents of `data/.token-key`. Exporting from a real account also needs `SUPABASE_SERVICE_ROLE_KEY` and `--user <uuid>`. Then:

```bash
npm run eval:export -- --user <your Supabase user id>   # samples about 220 emails into data/eval, encrypted (needs SUPABASE_SERVICE_ROLE_KEY and TOKEN_ENC_KEY)
npm run eval:label    # label them in the terminal; resumable, type q to stop
npm run eval:real     # precision and recall per field, rules only
npm run eval:real:llm # same, plus a column with the LLM fallback
npm run eval:real -- --report docs/eval-results.md   # aggregate-only report, safe to commit
rm -rf data/eval      # delete the corpus when you are done
```

- **Two samples.** 160 emails drawn at random (seeded) from what the app's Gmail query returns, which is what the extractor actually sees, and 60 drawn from all mail. The second sample estimates how much billing mail the query misses. Change the sizes with `--query` and `--random`. Only a few percent of all mail is billing, so with 60 random emails the query-recall number has a wide interval; use `--random 200` or more if you want it to mean something. The two samples are interleaved, so stopping partway through labeling still gives a fair mix.
- **Blind labeling.** The labeler shows the email, numbered amounts, dates, and https links found in its HTML and text, but never the app's prediction. Expect 30 to 60 seconds per email.
- **Numbers.** Each metric shows a Wilson 95% interval and its denominator. A metric with nothing to count shows `n/a`, not 100%.
- **Tuning.** If you change the rules after reading the mismatches, the same emails become training data. Quote the first run, or hold some emails back.

## Known limits

- Only emails are read. Rent, utilities, and anything paid without an email will not appear.
- Receipts that are only PDFs or images are not parsed.
- Merchants outside the alias table are named from the sender's display name, so a product sold by a larger company (YouTube Premium) shows under the company (Google).
- Amounts are in the currency symbol found in the email. There is no conversion.
- Relative dates such as "this Thursday" are not parsed.
- There is no forgot-password flow yet.
- Email confirmation links work only in the same browser that signed up.
- While the Google app is in "Testing" status, it allows up to 100 listed test users, and Google expires Gmail refresh tokens after 7 days. The dashboard then shows **Reconnect Gmail** and keeps your list.
- `gmail.readonly` is a restricted scope, so a public launch needs Google's restricted-scope verification and security assessment.
- Free Supabase projects pause after about a week idle.
- One sync runs per server process. On a host with several instances, a second sync may run in parallel.
- A long first scan can hit your host's function duration limit; sync resumes from stored records on the next run.
