import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { ForgotForm } from "@/components/PasswordReset";
import { isDemo } from "@/lib/session";

export const metadata = { title: "Reset your password | Phylax" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      aside={
        <>
          Remembered it? <Link href="/signin">Sign in</Link>
        </>
      }
    >
      <h1>Reset your password</h1>
      <p className="lede">Enter the email you signed up with and Phylax sends you a link.</p>
      <ForgotForm demo={isDemo()} />
    </AuthShell>
  );
}
