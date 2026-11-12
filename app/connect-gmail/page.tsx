import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import GmailDisclosure from "@/components/GmailDisclosure";
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
    <div className="su">
      <header className="su-head">
        <Link href="/" className="brand">
          Phylax
        </Link>
      </header>
      <div className="su-body">
        <main className="su-main">
          <h1>Connect Gmail</h1>
          <p className="lede">Google will ask you to allow read-only access. Here is what that means.</p>
          <GmailDisclosure />
          <Suspense fallback={null}>
            <ConnectActions searchParams={searchParams} />
          </Suspense>
        </main>
      </div>
    </div>
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
      <div className="su-actions">
        <a href={googleConsentHref(next)} className="btn btn-primary" aria-disabled={unconfigured ? true : undefined}>
          Continue to Google
        </a>
      </div>
    </>
  );
}
