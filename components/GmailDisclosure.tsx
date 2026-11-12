// What connecting Gmail means, shown before Google's consent screen: on sign-up step 2 and on
// /connect-gmail. The copy lives only here. Every line must match docs/legal/DATA_INVENTORY.md.
import Link from "next/link";

// "Can't" is what read-only access rules out; "won't" is a promise, so storing email text stays
// under "won't" (tests/gmail-disclosure.test.tsx).
const WILL = [
  "Search for receipts, invoices, renewals and trial notices",
  "Save the merchant, amount, dates and cancel link",
  "Check for new billing email when you sync",
];
const CANT = ["Send, delete, label or archive mail", "Open a cancel link for you"];
const WONT = ["Store the text of your emails"];

/** Envelope with a lock badge, at the top of the Connect Gmail card (SignUp.dc.html step 2). */
export function GmailIcon() {
  return (
    <span aria-hidden="true" className="gmail-icon">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#344C3D" strokeWidth="1.8">
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M3.5 7l8.5 6 8.5-6" />
      </svg>
      <span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
    </span>
  );
}

function NoList({ items }: { items: string[] }) {
  return (
    <ul className="list-plain">
      {items.map((w) => (
        <li key={w}>
          <span aria-hidden="true" className="no">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#93434C" strokeWidth="3.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </span>
          {w}
        </li>
      ))}
    </ul>
  );
}

export default function GmailDisclosure() {
  return (
    <>
      <div className="will">
        <div>
          <h2>Phylax will</h2>
          <ul className="list-plain">
            {WILL.map((w) => (
              <li key={w}>
                <span aria-hidden="true" className="yes">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#344C3D" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L19 7" />
                  </svg>
                </span>
                {w}
              </li>
            ))}
          </ul>
        </div>
        <div className="never">
          <h2>Phylax can&apos;t</h2>
          <NoList items={CANT} />
          <h2>Phylax won&apos;t</h2>
          <NoList items={WONT} />
        </div>
      </div>
      <div className="disclosure-detail">
        <p>
          When you sync, Phylax reads the sender, subject, text and links of emails that look like billing, including some promotions, from about the last 13
          months. It keeps the merchant, amount, currency, billing cycle, dates and cancel link from billing emails, plus each checked email&apos;s Gmail ID,
          date and type so it is not read twice. It also keeps your Gmail address and an encrypted Google access token until you disconnect.
        </p>
        <p>
          Records stay until you delete your account. Disconnecting removes the Google token but keeps your records. Phylax never uses your emails for ads or AI
          training. Your emails are processed only on Phylax&apos;s own server, hosted by Vercel. What Phylax keeps is saved in its database, hosted by
          Supabase. You can disconnect or delete your account at any time. <Link href="/privacy">Read the Privacy Policy</Link>
        </p>
        <p>You can connect any Gmail account. It does not have to match the email you signed up with.</p>
      </div>
    </>
  );
}
