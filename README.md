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

## Connect your Gmail

1. In Google Cloud Console, create a project and enable the **Gmail API**.
2. Configure the OAuth consent screen (External). Add the scope `.../auth/gmail.readonly` and add your own address as a test user.
3. Create an **OAuth client ID** of type Web application with the redirect URI `http://localhost:3000/api/auth/callback`.
4. Create `.env.local`:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# optional: LLM fallback for emails the rules cannot parse
ANTHROPIC_API_KEY=...
# required: 64 hex chars, encrypts the Gmail refresh token at rest (openssl rand -hex 32).
# Only demo mode (npm run demo) may run without it.
TOKEN_ENC_KEY=
```

5. `npm run dev`, open http://127.0.0.1:3000, choose **Connect Gmail**, then **Scan inbox**.

While the Google app is in "Testing" status, Google expires refresh tokens after 7 days, so you will need to reconnect weekly; the dashboard shows a **Reconnect Gmail** notice when that happens and keeps your list. `gmail.readonly` is a restricted scope, so publishing the app for other people requires Google's verification and a security assessment. For personal use, Testing mode is fine.

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
- State-changing routes accept only same-origin requests. OAuth uses a random `state` cookie. Tokens are encrypted with AES-256-GCM.
- The server binds to `127.0.0.1`. There is no login, so do not expose it on a network without adding authentication.

## Tests and eval

```bash
npm test            # unit tests, including prompt-injection and phishing cases
npm run eval        # extraction quality on the labeled fixtures
npm run eval:llm    # same, with the LLM fallback (needs ANTHROPIC_API_KEY)
```

The fixtures in `fixtures/emails.ts` are synthetic and were labeled and tuned by the author, so the score on them is a regression check, not a measure of real-world accuracy.

### Eval on your own inbox

Connect Gmail first (see above). Then:

```bash
npm run eval:export -- --user <your Supabase user id>   # samples about 220 emails into data/eval, encrypted (needs SUPABASE_SERVICE_ROLE_KEY)
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
