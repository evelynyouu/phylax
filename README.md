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
# optional: 64 hex chars, encrypts the Gmail refresh token at rest.
# If unset, a key file is generated in data/ with 0600 permissions.
TOKEN_ENC_KEY=
```

5. `npm run dev`, open http://127.0.0.1:3000, choose **Connect Gmail**, then **Scan inbox**.

While the Google app is in "Testing" status, Google expires refresh tokens after 7 days, so you will need to reconnect weekly. `gmail.readonly` is a restricted scope, so publishing the app for other people requires Google's verification and a security assessment. For personal use, Testing mode is fine.

## How it works

```
Gmail (read-only) -> sync -> rules extractor -> [low confidence] -> LLM fallback
                                  |                                      |
                                  +------------- records (SQLite) -------+
                                                       |
                                  entity resolution + recurrence detection
                                                       |
                                                   dashboard
```

- **Rules first.** Classification, amounts, dates, cadence, and cancel links come from patterns and a merchant table. The model only sees emails the rules score below 0.7, or that look billing-related but matched nothing.
- **Resolution.** Records are grouped by merchant. A merchant is a subscription when emails state a cadence, a renewal or trial notice exists, or charges repeat. One-off purchases are ignored. Cancelled subscriptions are detected from cancellation emails.
- **Storage.** Only the merchant, amount, dates, and cancel link from each email are saved, in `data/subwatch.db`. Email text is not stored.

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

The fixtures in `fixtures/emails.ts` are synthetic and were labeled and tuned by the author, so the score on them is a regression check, not a measure of real-world accuracy. To get a number worth quoting, label 150 to 200 of your own billing emails the same way (`Expected` in that file) and run the eval on those.

## Known limits

- Only emails are read. Rent, utilities, and anything paid without an email will not appear.
- Receipts that are only PDFs or images are not parsed.
- Merchants outside the alias table are named from the sender's display name, so a product sold by a larger company (YouTube Premium) shows under the company (Google).
- Amounts are in the currency symbol found in the email. There is no conversion.
- Relative dates such as "this Thursday" are not parsed.
