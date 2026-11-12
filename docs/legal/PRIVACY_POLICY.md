Draft for review. Not legal advice.

# Phylax Privacy Policy

Effective date: [EFFECTIVE DATE]
Last updated: [EFFECTIVE DATE]

Phylax is a free student project run by [DEVELOPER NAME] ("we", "us"). It is available at [APP URL]. It finds subscriptions, upcoming charges and bill deadlines in your Gmail and shows them to you. Phylax is not affiliated with Google.

This policy explains what Phylax collects, why, where it is kept, who it is shared with, how long it is kept, and how you can delete it. It is written to match how the app actually works today. If the app changes how it uses your Google data, we will update this policy and ask you to agree again before using your data in the new way.

## Google API disclosure (Limited Use)

Phylax's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

The use of information received from Google Workspace scopes will adhere to the [Google User Data Policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy), including the Limited Use requirements.

In plain terms:

- We use Gmail data only to show you your own subscriptions, bills and deadlines in Phylax.
- We do not sell Gmail data. We do not use it for advertising, and we do not give it to advertisers, data brokers or information resellers.
- We do not use Gmail data to decide credit-worthiness or for lending.
- We do not use Gmail data, and we do not let anyone else use it, to develop, improve or train generalized or non-personalized AI or machine learning models.
- No person reads your email. The only exceptions Google allows are when you ask us to look at specific messages and we keep a record of that request, when it is needed for security (for example, investigating abuse), or when the law requires it.

## What Phylax collects and why

### 1. Your Phylax account

| Data | Where it comes from | Why |
|---|---|---|
| Email address | You type it, or Google sends it when you choose "Continue with Google" | To create your account and sign you in |
| Password | You type it. It goes from your browser straight to our sign-in provider, Supabase. Our own server never receives it. | To sign you in with email and password |
| Name | You type it at sign-up, or Google sends your profile name | To show your name and initials in the app |
| Google profile details (if you sign in with Google): your Google account ID, name, email and profile picture link | Google, through Supabase sign-in | Supabase stores these with your account so you can sign in with Google |
| Profile photo (optional) | You upload it in the app | To show your picture next to your name. It is kept in a private storage area, shown only to you through links that expire after an hour, and Phylax deletes it when you remove it or delete your account. PNG, JPEG or WebP, up to 2 MB. |
| Sign-in session details (session tokens in cookies; Supabase also records session information such as IP address and browser type) | Your browser and Supabase | To keep you signed in and protect your account |

Signing in with Google only shares your basic profile (name, email, picture). It does not give Phylax access to your Gmail. Gmail access is a separate step.

### 2. Your Gmail connection

When you choose **Connect Gmail**, Google asks you to allow read-only access (`gmail.readonly`) plus your Gmail address (`openid`, `email`). Read-only means Phylax cannot send, delete, label, archive or change any email.

We store:

| Data | Why |
|---|---|
| The Gmail address you connected (it can differ from your Phylax email) | To show which inbox is connected and to detect when you connect a different one |
| Google access and refresh tokens (plus their expiry, scope and type), encrypted with AES-256-GCM before they are saved. Google's ID token is used once to read your Gmail address and is not saved | So Phylax can read new billing email when you sync, without asking you to sign in to Google every time |
| The time of the last successful scan, and whether Google has asked you to reconnect | To scan only new email next time and to show a "Reconnect Gmail" notice |

### 3. What Phylax reads in your Gmail

When you scan, Phylax searches your Gmail for likely billing email from about the last 13 months (receipts, invoices, renewals, trials, payment notices), skipping spam and trash. It reads at most 1,500 matching messages per scan. Some of the matches will be promotions or other mail that only looks like billing.

For each matching message, Phylax downloads the sender, subject, date, the text of the message and the links in it. This is processed in server memory to pull out billing facts. **The full text of your emails is not saved by Phylax.**

### 4. What Phylax saves from each email

For every message it processes, Phylax saves one record with only these fields:

- the Gmail message ID and the date the email was received
- what kind of email it is (for example receipt, renewal notice, trial ending, bill due, price change, cancellation, marketing, other) and whether it is billing-related
- the merchant name, the amount and currency, the billing cycle (weekly, monthly, quarterly, yearly)
- a due date and a renewal date, if the email states them
- a cancel or manage-subscription link taken from the email, and whether that link is on the sender's own website
- how confident the extraction was, and which method produced it (records created for your account are made by Phylax's fixed rules; the AI fallback is a local developer tool and is off for users, see "No AI processing" below)

For emails that turn out not to be billing-related, Phylax keeps only the message ID, the date, the kind of email, the confidence and the method, so the same email is not read again. The merchant, amount, dates and link are not saved for them.

We do not save the subject line, the sender address, or the body text.

### 5. Choices you make in the app

When you dismiss a subscription, mark one as cancelled, mark a bill as paid, turn on a dashboard reminder, or pick a category for a merchant, we save that choice with the time you made it. Phylax also picks a category for each merchant by itself, using fixed rules that run on Phylax's own server; nothing goes to an outside service to do this. Some "Needs attention" dismissals are saved only in your browser's local storage, not on our servers.

### 6. Technical logs

Our hosting provider, Vercel, keeps short-lived request logs (such as IP address, the page requested, browser type and errors). When something fails, Phylax's code logs only a short error message and code. It does not write email content, Google tokens or other credentials to logs. We do not use analytics, advertising cookies or tracking pixels.

### Do Not Track

Phylax does not track you across other websites and does not let third parties do so, so we do not change our behavior based on browser "Do Not Track" signals.

## Who we share data with

We share data only with the service providers that run Phylax, and only for that purpose. We do not sell or rent personal information.

| Provider | What they handle | Why | Their terms |
|---|---|---|---|
| **Supabase** | Your account, sign-in sessions, and every saved record, choice and encrypted Gmail token | Database and sign-in | [Supabase DPA](https://supabase.com/legal/dpa), [subprocessors](https://supabase.com/legal/subprocessors) |
| **Vercel** | All web traffic passes through Vercel, which runs the app's server code; Gmail data is processed in memory there during a scan | Hosting | [Vercel privacy notice](https://vercel.com/legal/privacy-policy), [Vercel trust center](https://security.vercel.com/) |
| **Google** | Sign-in with Google, and the Gmail API that Phylax reads from | Sign-in and reading your billing email | [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) |
| **[EMAIL DELIVERY PROVIDER]** [INCLUDE IF A CUSTOM SMTP PROVIDER IS SET UP IN SUPABASE] | Your email address and the sign-up confirmation message | Sending account emails | [LINK] |

### No AI processing

Phylax does not send your email to any AI service. Your emails are read only by Phylax's fixed rules. The code contains an optional AI fallback (Anthropic's Claude API), but it is a developer testing tool that runs only on the developer's own computer and own mailbox. It is off for every user account and is never used when Phylax scans your Gmail. If that ever changes, we will update this policy and ask for your consent first, as described under "Changes to this policy".

### Other disclosures

We may disclose information if the law requires it, or to investigate security problems or abuse. If Phylax is ever transferred to someone else, we will ask for your explicit consent before your Google data is transferred.

## Where data is stored

Saved data is stored in a Supabase Postgres database in [SUPABASE REGION]. The app runs on Vercel in [VERCEL REGION]. Both are in the United States unless stated otherwise. [CONFIRM REGIONS IN THE SUPABASE AND VERCEL DASHBOARDS.]

## How long we keep data

| Data | How long |
|---|---|
| Account, saved records, profile photo and your choices (including merchant categories) | Until you delete your account. You can remove your profile photo at any time. |
| Gmail tokens | Until you disconnect Gmail or delete your account. While the Google app is in testing, Google also expires them after 7 days. |
| Email text read during a scan | Only in memory for the length of the scan. Not saved. |
| Vercel request logs | Kept by Vercel for a short period set by our plan [CONFIRM: 1 hour on the Hobby plan per https://vercel.com/docs/logs/runtime] |
| Supabase sign-in logs and platform logs | Kept by Supabase for a period set by our plan [CONFIRM IN SUPABASE DASHBOARD] |

## How to control and delete your data

- **Disconnect Gmail** (in the app sidebar): Phylax asks Google to revoke its access and deletes the stored Gmail tokens. The records already found stay in your account until you delete it. If Google does not confirm the revocation, you can remove Phylax yourself at [Google Account permissions](https://myaccount.google.com/permissions).
- **Delete account** (in the app sidebar, type "delete" to confirm): Phylax asks Google to revoke its Gmail access and permanently deletes your Phylax account, your Gmail connection, every saved record and every choice you made. This cannot be undone. Your Gmail itself is not changed. If Google does not confirm the revocation, your account is still deleted; you can then remove Phylax at [Google Account permissions](https://myaccount.google.com/permissions).
- After deleting, you can also clear this site's data in your browser to remove anything saved in local storage.
- To ask a question, get a copy of your data, or request deletion if you cannot sign in, email [CONTACT EMAIL]. We will reply within [NUMBER] days.

## How we protect data

- Gmail access is read-only.
- Google tokens are encrypted with AES-256-GCM before they are stored, and the key is kept outside the database.
- All traffic uses HTTPS. Supabase states it encrypts stored data with AES-256 ([Supabase security](https://supabase.com/security)).
- Database row level security limits each account to its own rows.
- Actions that change data accept only requests from Phylax's own pages from a signed-in user (connecting Gmail is protected by a one-time state check instead).
- Phylax's pages tell browsers not to let other sites frame them, and to send only limited referrer information to other sites.

No system is perfectly secure. If we learn of a breach that affects your personal information, we will notify you and others as the law requires.

## Children

Phylax is not for children under 13, and we do not knowingly collect information from them. If you believe a child under 13 has created an account, email [CONTACT EMAIL] and we will delete it.

## Changes to this policy

We will post any change here with a new "Last updated" date. If a change affects how we use your Google data, we will tell you in the app and ask you to agree before using your data in the new way.

## Contact

[DEVELOPER NAME]
[CONTACT EMAIL]
