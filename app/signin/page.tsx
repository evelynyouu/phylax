import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Flower from "@/components/Flower";
import AuthForm from "@/components/AuthForm";
import { AUTH_MESSAGES } from "@/lib/auth-copy";
import { getOptionalUser } from "@/lib/current-user";
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
          <p className="lede">Use Google or your email and password.</p>
          <Suspense fallback={null}>
            <SignInStatus searchParams={searchParams} />
          </Suspense>

          <AuthForm mode="signin" demo={isDemo()} />
          <p className="auth-foot">
            New to Subwatch? <Link href="/signup">Create an account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

/** Request-time part: sends signed-in visitors on to the app and shows any ?auth= message. */
async function SignInStatus({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  if (await getOptionalUser()) {
    // Demo mode is always signed in; after "Sign out" it stays here to show the message.
    if (!isDemo() || sp.auth !== "signed_out") redirect("/app");
  }
  const code = typeof sp.auth === "string" ? sp.auth : null;
  const msg = code ? AUTH_MESSAGES[code] : null;
  if (!msg) return null;
  return (
    <p role="alert" className={`auth-msg${msg.info ? " info" : ""}`}>
      {msg.text}
    </p>
  );
}
