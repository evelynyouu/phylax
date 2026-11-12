import AuthShell from "@/components/AuthShell";
import { ResetForm } from "@/components/PasswordReset";

export const metadata = { title: "Choose a new password | Phylax" };

// Reached from the emailed reset link through /auth/callback, which signs the person in first.
export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <h1>Choose a new password</h1>
      <p className="lede">You are signed in from the link in your email. Pick a new password to finish.</p>
      <ResetForm />
    </AuthShell>
  );
}
