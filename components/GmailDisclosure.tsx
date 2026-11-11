// What connecting Gmail means, shown before Google's consent screen: on sign-up step 2 and on
// /connect-gmail. The copy lives only here. Every line must match docs/legal/DATA_INVENTORY.md.
export default function GmailDisclosure() {
  return (
    <>
      <div className="will">
        <div className="yes">
          <h2>Subwatch will</h2>
          <ul>
            <li>Search for receipts, invoices, renewals and trial notices</li>
            <li>Save the merchant, amount, dates and cancel link</li>
            <li>Check for new billing email when you sync</li>
          </ul>
        </div>
        <div className="no">
          <h2>Subwatch can&apos;t</h2>
          <ul>
            <li>Send, delete, label or archive mail</li>
            <li>Store the text of your emails</li>
            <li>Open a cancel link for you</li>
          </ul>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        Subwatch keeps the merchant, amount, dates and cancel link it finds. It never stores the text of your emails and never uses them for ads
        or AI training. Your emails are processed only on Subwatch&apos;s own server, hosted by Vercel. What Subwatch keeps is saved in its
        database, hosted by Supabase. You can disconnect or delete your account at any time.
      </p>
      <p className="muted" style={{ marginTop: 16 }}>
        You can connect any Gmail account. It does not have to match the email you signed up with.
      </p>
    </>
  );
}
