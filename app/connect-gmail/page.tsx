import { connection } from "next/server";
import { Suspense } from "react";
import AuthShell from "@/components/AuthShell";
import GmailDisclosure, { GmailIcon } from "@/components/GmailDisclosure";
import { GMAIL_MESSAGES, googleConsentHref } from "@/lib/auth-copy";
import { getCurrentUser } from "@/lib/current-user";
import { gmailConfigured } from "@/lib/gmail";
import { isDemo } from "@/lib/session";

export const metadata = { title: "Connect Gmail | Phylax" };

// Shown before Google's consent screen (Google API Services User Data Policy: prominent
// disclosure). Every in-app Connect or Reconnect button lands here; sign-up step 2 shows the same
// GmailDisclosure and goes straight to Google. The proxy sends signed-out visitors to /signin.
export default function ConnectGmailPage({ searchParams }: PageProps<"/connect-gmail">) {
  return (
    <AuthShell wide>
      <GmailIcon />
      <h1>Connect your Gmail</h1>
      <p className="lede">Phylax needs read-only access to find receipts, renewals and trial reminders. Google asks you to allow it next.</p>
      <GmailDisclosure />
      <Suspense fallback={null}>
        <ConnectActions searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function ConnectActions({ searchParams }: { searchParams: PageProps<"/connect-gmail">["searchParams"] }) {
  await connection();
  await getCurrentUser();
  const { next } = await searchParams;
  const unconfigured = !isDemo() && !gmailConfigured();
  return (
    <>
      {unconfigured && <p className="auth-msg">{GMAIL_MESSAGES.not_configured.text}</p>}
      <a href={googleConsentHref(next)} className="btn btn-primary btn-block auth-cta" aria-disabled={unconfigured ? true : undefined}>
        Continue to Google
      </a>
      <p className="fine">You can disconnect at any time.</p>
    </>
  );
}
