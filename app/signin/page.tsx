import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import AuthShell from "@/components/AuthShell";
import PhylaxMark from "@/components/PhylaxMark";
import { AUTH_MESSAGES } from "@/lib/auth-copy";
import { getOptionalUser } from "@/lib/current-user";

export const metadata = { title: "Sign in | Phylax" };

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <AuthShell
      aside={
        <>
          New here? <Link href="/signup">Create an account</Link>
        </>
      }
    >
      <span aria-hidden="true" className="auth-icon">
        <PhylaxMark size={32} className="sway" />
      </span>
      <h1>Welcome back</h1>
      <p className="lede">Your list kept growing while you were away.</p>
      <Suspense fallback={null}>
        <SignInStatus searchParams={searchParams} />
      </Suspense>
      <AuthForm mode="signin" />
    </AuthShell>
  );
}

/** Request-time part: sends signed-in visitors on to the app and shows any ?auth= message. */
async function SignInStatus({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  if (await getOptionalUser()) redirect("/app");
  const code = typeof sp.auth === "string" ? sp.auth : null;
  const msg = code ? AUTH_MESSAGES[code] : null;
  if (!msg) return null;
  return (
    <p role="alert" className={`auth-msg${msg.info ? " info" : ""}`}>
      {msg.text}
    </p>
  );
}
