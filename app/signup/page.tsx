import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import FirstScan from "@/components/FirstScan";
import AuthForm from "@/components/AuthForm";
import { AUTH_MESSAGES } from "@/lib/auth-copy";
import { getOptionalUser } from "@/lib/current-user";
import { gmailConfigured } from "@/lib/gmail";
import { isDemo } from "@/lib/session";

export const metadata = { title: "Create your account | Subwatch" };

const STEPS = [
  ["Create account", "Name, email and password"],
  ["Connect Gmail", "Read-only access"],
  ["First scan", "About a minute"],
] as const;

export default function SignUpPage({ searchParams }: PageProps<"/signup">) {
  return (
    <div className="su">
      <header className="su-head">
        <Link href="/" className="brand">
          Subwatch
        </Link>
        <p>
          Have an account? <Link href="/signin">Sign in</Link>
        </p>
      </header>
      <Suspense fallback={<div className="su-body" />}>
        <SignUpBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SignUpBody({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const asked = Number(sp.step);
  const signedIn = (await getOptionalUser()) !== null;
  // Steps 2 and 3 need a session: connecting Gmail belongs to a signed-in account.
  const step = signedIn && (asked === 2 || asked === 3) ? asked : 1;
  const code = typeof sp.auth === "string" ? sp.auth : null;
  const msg = code ? AUTH_MESSAGES[code] : null;
  const connectHref = isDemo() ? "/signup?step=3" : "/api/auth/google?next=signup";

  return (
    <div className="su-body">
      <nav aria-label="Sign-up steps" className="steps">
        <ol>
          {STEPS.map(([t, s], i) => {
            const n = i + 1;
            return (
              <li key={t} aria-current={n === step ? "step" : undefined} className={n < step ? "done" : undefined}>
                <span className="mark" aria-hidden="true">
                  {n < step ? "✓" : n}
                </span>
                <span>
                  <span className="t">
                    {t}
                    {n < step && <span className="sr-only"> (done)</span>}
                  </span>
                  <span className="s">{s}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      <main className="su-main">
        {msg && (
          <p role="alert" className={`auth-msg${msg.info ? " info" : ""}`} style={{ marginTop: 0, marginBottom: 20 }}>
            {msg.text}
          </p>
        )}

        {step === 1 && (
          <>
            <h1>Create your account</h1>
            <p className="lede">Then connect Gmail and Subwatch starts the first scan.</p>
            <AuthForm mode="signup" demo={isDemo()} />
          </>
        )}

        {step === 2 && (
          <>
            <h1>Connect Gmail</h1>
            <p className="lede">Google will ask you to allow read-only access. Here is exactly what that means.</p>
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
            {!isDemo() && !gmailConfigured() && <p className="auth-msg">{AUTH_MESSAGES.not_configured.text}</p>}
            <div className="su-actions">
              <a href={connectHref} className="btn btn-primary" aria-disabled={!isDemo() && !gmailConfigured() ? true : undefined}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                {isDemo() ? "Use the sample inbox" : "Connect Gmail"}
              </a>
              <Link href="/signup" className="btn btn-ghost">
                Back
              </Link>
            </div>
          </>
        )}

        {step === 3 && <FirstScan />}
      </main>
    </div>
  );
}
