import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import AuthShell from "@/components/AuthShell";
import FirstScan from "@/components/FirstScan";
import GmailDisclosure, { GmailIcon } from "@/components/GmailDisclosure";
import { AUTH_MESSAGES, GMAIL_MESSAGES } from "@/lib/auth-copy";
import { getOptionalUser } from "@/lib/current-user";
import { gmailConfigured } from "@/lib/gmail";

export const metadata = { title: "Create your account | Phylax" };

// Three steps in one centered card, as in SignUp.dc.html: account, Connect Gmail, first scan.
export default function SignUpPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthShell
      aside={
        <>
          Have an account? <Link href="/signin">Sign in</Link>
        </>
      }
      wide
    >
      <Suspense fallback={<h1>Create your account</h1>}>
        <SignUpBody searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function SignUpBody({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const asked = Number(sp.step);
  const user = await getOptionalUser();
  // Step 3 needs a session. Step 2 works signed out too: that is "Continue with Google", where
  // one Google screen creates the account and connects Gmail.
  const step = asked === 2 || (user && asked === 3) ? asked : 1;
  const code = typeof sp.auth === "string" ? sp.auth : null;
  // Steps 2 and 3 only get codes from the Connect Gmail flow; step 2 already says inline when
  // Gmail is not configured, so that code is not repeated at the top.
  const messages = step === 1 ? AUTH_MESSAGES : GMAIL_MESSAGES;
  const msg = code && !(step === 2 && code === "not_configured") ? messages[code] : null;
  const connectHref = "/api/auth/google?next=signup";
  const first = user?.name.trim().split(/\s+/)[0] ?? "";
  const notice = msg && (
    <p role="alert" className={`auth-msg${msg.info ? " info" : ""}`}>
      {msg.text}
    </p>
  );

  if (step === 2) {
    const unconfigured = !gmailConfigured();
    // Signed out here means "Continue with Google" from step 1: the one Google screen also creates the account.
    const viaGoogle = !user;
    return (
      <>
        <GmailIcon />
        <h1>{viaGoogle ? "Sign up with Google" : "Connect your Gmail"}</h1>
        <p className="lede">
          {viaGoogle
            ? "One Google screen creates your Phylax account and gives read-only access to find receipts, renewals and trial reminders."
            : `${first ? `Nice to meet you, ${first}. ` : ""}Phylax needs read-only access to find receipts, renewals and trial reminders.`}
        </p>
        {notice}
        <GmailDisclosure />
        {unconfigured && <p className="auth-msg">{GMAIL_MESSAGES.not_configured.text}</p>}
        <a href={connectHref} className="btn btn-primary btn-block auth-cta" aria-disabled={unconfigured ? true : undefined}>
          {viaGoogle ? "Continue with Google" : "Connect Gmail"}
        </a>
        <p className="fine">
          {viaGoogle ? (
            <>
              Google shows its permission screen next. By creating an account you agree to the <Link href="/terms">Terms</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </>
          ) : (
            "Google shows its permission screen next. You can disconnect at any time."
          )}
        </p>
        <Link href="/signup" className="auth-back">
          Back
        </Link>
      </>
    );
  }

  if (step === 3) return <FirstScan />;

  return (
    <>
      <h1>Create your account</h1>
      {notice}
      <AuthForm mode="signup" />
    </>
  );
}
