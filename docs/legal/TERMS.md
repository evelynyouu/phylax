Draft for review. Not legal advice.

# Phylax Terms of Use

Effective date: [EFFECTIVE DATE]

These terms are an agreement between you and [DEVELOPER NAME] ("we", "us"), who runs Phylax at [APP URL]. By creating an account or using Phylax, you agree to these terms and to the [Privacy Policy]([APP URL]/privacy). If you do not agree, do not use Phylax.

## 1. What Phylax is

Phylax is a free student project. It reads billing emails in a Gmail account you connect, with read-only access, and shows the subscriptions, charges, bills and deadlines it finds, along with cancel links taken from those emails. It may change, break, or shut down at any time.

## 2. Phylax never cancels anything for you

Phylax does not cancel subscriptions, pay bills, contact merchants, or change anything in your Gmail or any other account. A "Cancel" button only opens a link that was in the company's own email. You are responsible for cancelling subscriptions, paying bills and meeting deadlines yourself, and for checking with the company that a cancellation went through. Marking something as "cancelled" or "paid" in Phylax only changes what Phylax shows you.

## 3. Results can be wrong

Phylax reads emails with automatic rules. It can miss subscriptions, show the wrong amount, date or merchant, or show a link that is not what it seems. Charges that are not announced by email (for example rent, utilities, or receipts that are only PDFs or images) will not appear. Always check the original email and the company's own website before you act. Do not rely on any amount, date or statement in Phylax without checking it yourself.

## 4. Not financial advice

Phylax shows information found in your emails. It is not financial, legal, tax or investment advice, and it does not tell you which subscriptions to keep.

## 5. Who can use Phylax

You must be at least 13 years old to use Phylax. [OPTIONAL: Because Phylax deals with payment information, you may choose to require users to be 18 or older.] You may only connect a Gmail account that you own or are authorized to connect.

## 6. Your account

Keep your password safe and tell us at [CONTACT EMAIL] if you think someone else has used your account. You are responsible for activity in your account.

## 7. Acceptable use

Do not:

- connect someone else's Gmail account without their permission;
- try to access another user's data, or test, probe or attack Phylax's security, except through responsible disclosure to [CONTACT EMAIL];
- overload the service, scrape it, or use bots or automated scripts against it;
- use Phylax to break any law or Google's terms for Gmail;
- copy, resell or reverse engineer the service, except as allowed by its source-code license [IF THE REPO IS PUBLIC, NAME THE LICENSE].

## 8. Google and other services

Phylax uses Google sign-in and the Gmail API. Your use of Google services is also governed by Google's terms. You can remove Phylax's Gmail access at any time with **Disconnect Gmail** in the app or at [Google Account permissions](https://myaccount.google.com/permissions). Links to merchant websites go to sites we do not control.

## 9. Ending your use

You can stop using Phylax at any time and delete your account in the app. Deleting your account permanently deletes your Phylax data as described in the Privacy Policy. We may suspend or close accounts that break these terms or put the service or other users at risk, and we may shut Phylax down. If we shut it down, we will try to give notice in the app or by email and will delete stored data as described in the Privacy Policy.

## 10. No warranty

Phylax is provided "as is" and "as available", without warranties of any kind, express or implied, including any warranty of accuracy, merchantability, fitness for a particular purpose, or non-infringement, to the fullest extent the law allows.

## 11. Limitation of liability

To the fullest extent the law allows, we are not liable for any indirect, incidental, special or consequential damages, or for any missed cancellation, missed payment, late fee, charge, or lost data, arising from your use of Phylax. Our total liability for any claim about Phylax is limited to [USD 0 / USD 50; CHOOSE WITH COUNSEL]. Some places do not allow these limits, so they may not apply to you.

## 12. Changes to these terms

We may update these terms. We will post the new version here with a new effective date, and for important changes we will tell you in the app. If you keep using Phylax after a change, you accept the new terms.

## 13. Governing law

These terms are governed by the laws of [STATE], United States, without regard to its conflict of law rules. Disputes will be handled in the courts of [COUNTY, STATE], unless the law where you live requires otherwise.

## 14. Contact

[DEVELOPER NAME], [CONTACT EMAIL]

---

## Notes for the reviewer (delete before publishing)

- Section 3 also covers a duty in Anthropic's Commercial Terms, section D.3: the customer "must notify its Users, that factual assertions in Outputs should not be relied upon without independently checking their accuracy". The AI fallback is now off for users (it is a local eval tool), so this duty does not apply today; keep the warning anyway, since the rules can be wrong too, and revisit if the fallback is ever turned on for users. Source: https://www.anthropic.com/legal/commercial-terms
- Age 13: COPPA applies to operators of sites directed to children under 13 and to general audience sites with actual knowledge that they collect personal information from children under 13; the FTC says general audience operators may block children if they choose. Source: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions . Google's User Data Policy says apps directed primarily at children should not use Google Sign-In: https://developers.google.com/terms/api-services-user-data-policy . Nothing found in these sources requires a higher age than 13 for a general audience app; choosing 18+ is a business decision, not a requirement from these sources.
- The amount in section 11 and the choice of law in section 13 are placeholders on purpose.
