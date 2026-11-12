"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AUTH_MESSAGES, passwordStrength, PASSWORD_HINT } from "@/lib/auth-copy";
import { cleanCode, isCodeShaped, resetErrorMessage, RESEND_SECONDS, sendOutcome } from "@/lib/password-reset";
import { supabaseEnv } from "@/lib/supabase/config";
import { supabaseBrowser } from "@/lib/supabase/browser";
import PasswordField from "./PasswordField";
import { Field } from "./ui";

type Step = "email" | "code" | "password";

/** Forgot password: email a code, verify it (which signs the person in), then set a new password. */
export default function ResetByCode({ initialEmail = "" }: { initialEmail?: string }) {
  const router = useRouter();
  const configured = supabaseEnv() !== null;
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail.trim());
  const [known, setKnown] = useState(initialEmail.includes("@"));
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const strength = passwordStrength(pw);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const address = email.trim();
    if (!address.includes("@")) return setError("Enter an email address with an @.");
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(address);
    setBusy(false);
    // Step 1 moves on whatever the result, so it can't be used to check which addresses have accounts.
    // Only "Send a new code" (already on step 2) shows a send error; see sendOutcome.
    const outcome = sendOutcome(step, error);
    setEmail(address);
    setCooldown(RESEND_SECONDS);
    if (outcome.error) return setError(outcome.error);
    setCode("");
    setStep("code");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    const token = cleanCode(code);
    if (!isCodeShaped(token)) return setError(resetErrorMessage("otp_expired"));
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.verifyOtp({ email, token, type: "recovery" });
    setBusy(false);
    if (error) return setError(resetErrorMessage(error.code ?? "otp_expired"));
    setStep("password");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError(PASSWORD_HINT);
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    if (error) {
      setBusy(false);
      return setError(resetErrorMessage(error.code));
    }
    router.push("/app");
  }

  const messages = (
    <>
      {!configured && <p className="auth-msg">{AUTH_MESSAGES.accounts_not_configured.text}</p>}
      {error && (
        <p role="alert" className="auth-msg">
          {error}
        </p>
      )}
    </>
  );

  if (step === "password")
    return (
      <>
        <h1>Choose a new password</h1>
        <form onSubmit={save} noValidate className="auth-form">
          {messages}
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
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !configured}>
            {busy ? "Saving" : "Save new password"}
          </button>
        </form>
      </>
    );

  if (step === "code")
    return (
      <>
        <h1>Reset your password</h1>
        <p className="lede">We sent a verification code to {email}. Enter it below.</p>
        <form onSubmit={verify} noValidate className="auth-form">
          {messages}
          <Field
            id="rp-code"
            name="code"
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={!configured}
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !configured}>
            {busy ? "Checking" : "Verify code"}
          </button>
          <button type="button" className="link-btn" onClick={() => sendCode()} disabled={busy || cooldown > 0 || !configured}>
            {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
          </button>
        </form>
      </>
    );

  return (
    <>
      <h1>Reset your password</h1>
      <form onSubmit={sendCode} noValidate className="auth-form">
        {messages}
        {known ? (
          <>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || !configured}>
              {busy ? "Sending" : `Send a verification email to ${email}`}
            </button>
            <button type="button" className="link-btn" onClick={() => setKnown(false)}>
              Use a different email
            </button>
          </>
        ) : (
          <>
            <Field
              id="fp-email"
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!configured}
            />
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || !configured}>
              {busy ? "Sending" : "Send verification email"}
            </button>
          </>
        )}
      </form>
    </>
  );
}
