"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AUTH_MESSAGES, authErrorMessage, passwordStrength, PASSWORD_HINT } from "@/lib/auth-copy";
import { supabaseEnv } from "@/lib/supabase/config";
import { supabaseBrowser } from "@/lib/supabase/browser";
import PasswordField from "./PasswordField";
import { Field } from "./ui";

/** /forgot-password: Supabase emails a link that signs the person in and lands on /reset-password. */
export function ForgotForm({ demo }: { demo: boolean }) {
  const configured = !demo && supabaseEnv() !== null;
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email.includes("@")) return setError("Enter an email address with an @.");
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, {
      // Same origin as the PKCE verifier cookie; safeNext allows /reset-password.
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
    setBusy(false);
    // Same answer whether or not the account exists, so the form can't be used to check addresses.
    if (error && error.status !== 400 && error.status !== 404) return setError(authErrorMessage(error.message, error.code));
    setSent(true);
  }

  if (demo) return <p className="auth-msg info">The demo has no passwords. Open it from the sign-in page.</p>;
  if (sent)
    return (
      <p role="status" className="auth-msg info">
        If there is an account for that email, a link to reset the password is on its way. It works once and expires in an hour.
      </p>
    );
  return (
    <form onSubmit={submit} noValidate className="auth-form">
      {!configured && <p className="auth-msg">{AUTH_MESSAGES.accounts_not_configured.text}</p>}
      {error && (
        <p role="alert" className="auth-msg">
          {error}
        </p>
      )}
      <Field id="fp-email" name="email" label="Email" type="email" autoComplete="email" placeholder="example@gmail.com" disabled={!configured} />
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !configured}>
        {busy ? "Sending" : "Send reset link"}
      </button>
    </form>
  );
}

/** /reset-password: the emailed link has signed the person in; set a new password. */
export function ResetForm() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const strength = passwordStrength(pw);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pw.length < 8) return setError(PASSWORD_HINT);
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      if (error.name === "AuthSessionMissingError" || error.status === 401) return setExpired(true);
      return setError(authErrorMessage(error.message, error.code));
    }
    router.push("/app");
  }

  if (expired)
    return (
      <p role="alert" className="auth-msg">
        This reset link has expired or was already used. <Link href="/forgot-password">Ask for a new one</Link>.
      </p>
    );
  return (
    <form onSubmit={submit} noValidate className="auth-form">
      {error && (
        <p role="alert" className="auth-msg">
          {error}
        </p>
      )}
      <div>
        <PasswordField id="rp-pw" label="New password" autoComplete="new-password" value={pw} onChange={setPw} describedBy="rp-pw-help" />
        <div aria-hidden="true" className={`meter tone-${strength.tone}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < strength.score ? "on" : undefined} />
          ))}
        </div>
        <p id="rp-pw-help" className={strength.tone === "weak" ? "field-error" : "field-hint"} aria-live="polite">
          {strength.text || PASSWORD_HINT}
        </p>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "Saving" : "Save new password"}
      </button>
    </form>
  );
}
