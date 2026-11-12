# Supabase accounts (spec)

Source: the author's decisions in session, 2026-11-10.

## Goal

Real accounts so Phylax can be deployed: anyone signs up, connects their own Gmail, and sees only their own data.

## Decisions

- Accounts: Supabase Auth with email/password and Google sign-in. The sign-in and sign-up forms that say "coming soon" become real.
- Data: moves from the local SQLite file to Supabase Postgres, every row scoped to the user with row-level security (RLS).
- Gmail: "Connect Gmail" stays a separate consent step with the app's own Google OAuth client and scope `gmail.readonly`. Supabase does not refresh Google provider tokens, so Phylax keeps storing and refreshing the Gmail refresh token itself, encrypted with AES-256-GCM.
- Simplest to develop and test: a free hosted Supabase project (no Docker on the dev machine). Unit tests stay offline.
- Demo mode (`npm run demo`) keeps working with no Supabase and no Google, on sample data only.
- Bank data is a separate, later plan (bank alert emails read from Gmail). Out of scope here.
- No paid services.

## Carried over

- The review of the `redesign` branch found five issues. With per-user accounts, three disappear (demo reading real data, account switching mixing data, stale owner cookies). Two remain and are fixed here: one-off purchases undo "I've cancelled it", and one-off purchases show on the calendar as subscription charges.
- Everything from the redesign keeps working: all pages, the hero, paid bills, reminders, manual cancels, the cancel-link trust warning.
- `npm test`, `npm run eval`, `npx tsc --noEmit`, `npm run lint`, `npm run build` pass. No em dashes in UI copy.
