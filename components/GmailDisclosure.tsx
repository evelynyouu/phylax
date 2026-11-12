// What connecting Gmail means, shown before Google's consent screen: on sign-up step 2 and on
// /connect-gmail. The copy lives only here. Every line must match docs/legal/DATA_INVENTORY.md.
import Link from "next/link";

export default function GmailDisclosure() {
  return (
    <>
      <div className="will">
        <div className="yes">
          <h2>Phylax will</h2>
          <ul>
            <li>Search for receipts, invoices, renewals and trial notices</li>
            <li>Save the merchant, amount, dates and cancel link</li>
            <li>Check for new billing email when you sync</li>
          </ul>
        </div>
        <div className="no">
          <h2>Phylax can&apos;t</h2>
          <ul>
            <li>Send, delete, label or archive mail</li>
            <li>Open a cancel link for you</li>
          </ul>
          <h2>Phylax won&apos;t</h2>
          <ul>
            <li>Store the text of your emails</li>
          </ul>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        When you sync, Phylax reads the sender, subject, text and links of emails that look like billing, including some promotions, from
        about the last 13 months. It keeps the merchant, amount, currency, billing cycle, dates and cancel link from billing emails, plus each
        checked email&apos;s Gmail ID, date and type so it is not read twice. It also keeps your Gmail address and an encrypted Google access
        token until you disconnect.
      </p>
      <p className="muted" style={{ marginTop: 16 }}>
        Records stay until you delete your account. Disconnecting removes the Google token but keeps your records. Phylax never uses your
        emails for ads or AI training. Your emails are processed only on Phylax&apos;s own server, hosted by Vercel. What Phylax keeps is saved in its
        database, hosted by Supabase. You can disconnect or delete your account at any time.{" "}
        <Link href="/privacy">Read the Privacy Policy</Link>
      </p>
      <p className="muted" style={{ marginTop: 16 }}>
        You can connect any Gmail account. It does not have to match the email you signed up with.
      </p>
    </>
  );
}
