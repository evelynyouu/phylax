import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Flower from "@/components/Flower";
import GoogleIcon from "@/components/GoogleIcon";
import { Field, Tag } from "@/components/ui";
import { AUTH_MESSAGES } from "@/lib/auth-messages";
import { getOptionalUser } from "@/lib/current-user";
import { gmailConfigured } from "@/lib/gmail";
import { isDemo } from "@/lib/session";

export const metadata = { title: "Sign in | Subwatch" };

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <div className="split">
      <aside className="split-art">
        <Link href="/" className="brand">
          Subwatch
        </Link>
        <Flower />
        <p className="quote">Welcome back. Your list kept growing while you were away.</p>
      </aside>
      <main className="split-main">
        <div className="auth-box">
          <h1>Sign in</h1>
          <p className="lede">Use the Google account whose Gmail you connected.</p>
          <Suspense fallback={<div style={{ minHeight: 52, marginTop: 28 }} />}>
            <SignInActions searchParams={searchParams} />
          </Suspense>

          <p className="or">or use email</p>
          <form aria-describedby="email-soon">
            <p id="email-soon" style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
              Email and password sign-in <Tag tone="neutral">Coming soon</Tag>
            </p>
            <div className="stack-16">
              <Field id="si-email" label="Email" type="email" autoComplete="email" placeholder="you@berkeley.edu" disabled />
              <Field id="si-pw" label="Password" type="password" autoComplete="current-password" disabled />
            </div>
            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 26 }} disabled>
              Sign in
            </button>
          </form>
          <p className="auth-foot">
            New to Subwatch? <Link href="/signup">Create an account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

async function SignInActions({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  if (await getOptionalUser()) {
    if (!isDemo() || sp.auth !== "signed_out") redirect("/app");
  }
  const code = typeof sp.auth === "string" ? sp.auth : null;
  const msg = code ? AUTH_MESSAGES[code] : null;

  return (
    <>
      {msg && (
        <p role="alert" className={`auth-msg${msg.info ? " info" : ""}`}>
          {msg.text}
        </p>
      )}
      {isDemo() ? (
        <Link href="/app" className="btn btn-primary btn-google" style={{ background: "var(--evergreen)", color: "#fff", borderColor: "var(--evergreen)" }}>
          Open the demo
        </Link>
      ) : gmailConfigured() ? (
        <a href="/api/auth/google?next=app" className="btn btn-google">
          <GoogleIcon />
          Continue with Google
        </a>
      ) : (
        <p className="auth-msg">{AUTH_MESSAGES.not_configured.text}</p>
      )}
    </>
  );
}
