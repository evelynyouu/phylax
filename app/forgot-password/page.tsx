import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import AuthShell from "@/components/AuthShell";
import ResetByCode from "@/components/ResetByCode";

export const metadata = { title: "Reset your password | Phylax" };

export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  return (
    <AuthShell
      aside={
        <>
          Remembered it? <Link href="/signin">Sign in</Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <ResetStart searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

/** Request-time part: reads ?email= (set by the sign-in page's Forgot password link). */
async function ResetStart({ searchParams }: { searchParams: PageProps<"/forgot-password">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email : "";
  return <ResetByCode initialEmail={email} />;
}
