"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ACCOUNT_EXISTS_MESSAGE,
  AUTH_MESSAGES,
  authErrorMessage,
  fullName,
  passwordStrength,
  signupAlreadyExists,
  validateSignup,
  type SignupErrors,
} from "@/lib/auth-copy";
import { supabaseEnv } from "@/lib/supabase/config";
import { supabaseBrowser } from "@/lib/supabase/browser";
import GoogleIcon from "./GoogleIcon";
import PasswordField from "./PasswordField";
import { Field } from "./ui";

const NEXT = { signin: "/app", signup: "/signup?step=2" } as const;

function callbackUrl(next: string): string {
  // The PKCE code verifier cookie lives on this origin, so the callback must too.
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

/**
 * Email and password plus Google, for sign-in and sign-up step 1. Errors show inline.
 */
export default function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const next = NEXT[mode];
  const configured = supabaseEnv() !== null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignupErrors>({});
  const [pw, setPw] = useState("");

  async function google() {
    setError("");
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(next) },
    });
    // On success the browser is already leaving for Google.
    if (error) {
      setError(authErrorMessage(error.message, error.code));
      setBusy(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = fullName(String(form.get("first") ?? ""), String(form.get("last") ?? ""));

    if (mode === "signup") {
      const errors = validateSignup({ name, email, password });
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }
    setBusy(true);
    try {
      const auth = supabaseBrowser().auth;
      if (mode === "signin") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) return setError(authErrorMessage(error.message, error.code));
        return window.location.assign(next);
      }
      const { data, error } = await auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: callbackUrl(next) },
      });
      if (error) return setError(authErrorMessage(error.message, error.code));
      // Confirm email on and the address is taken: Supabase answers success with no identities.
      if (signupAlreadyExists(data)) return setError(ACCOUNT_EXISTS_MESSAGE);
      // No session means the project asks people to confirm their email first.
      if (!data.session) return setInfo("Check your email for a link to confirm your account. It brings you back here to connect Gmail.");
      return window.location.assign(next);
    } catch {
      setError(authErrorMessage(""));
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !configured;
  const messages = (
    <>
      {!configured && <p className="auth-msg">{AUTH_MESSAGES.accounts_not_configured.text}</p>}
      {error && (
        <p role="alert" className="auth-msg">
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="auth-msg info">
          {info}
        </p>
      )}
    </>
  );

  const googleButton = (
    <button type="button" className="btn btn-google" onClick={google} disabled={disabled}>
      <GoogleIcon />
      Continue with Google
    </button>
  );

  if (mode === "signin") {
    return (
      <>
        {messages}
        {googleButton}
        <p className="or">or use email</p>
        <form onSubmit={submit} className="auth-form">
          <Field id="si-email" name="email" label="Email" type="email" autoComplete="email" placeholder="example@gmail.com" required disabled={!configured} />
          <PasswordField
            id="si-pw"
            label="Password"
            autoComplete="current-password"
            disabled={!configured}
            labelAside={<Link href="/forgot-password">Forgot password?</Link>}
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={disabled}>
            {busy ? "Signing in" : "Sign in"}
          </button>
        </form>
        <p className="fine agree">
          By creating an account you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </>
    );
  }

  const strength = passwordStrength(pw);
  const pwMessage = fieldErrors.password ?? strength.text;
  const pwWarn = Boolean(fieldErrors.password) || strength.tone === "weak";
  return (
    <form onSubmit={submit} noValidate className="auth-form">
      {messages}
      {googleButton}
      <p className="or">or with email</p>
      <div className="form-pair">
        <Field id="su-first" name="first" label="First name" autoComplete="given-name" placeholder="First" error={fieldErrors.name} disabled={!configured} />
        <Field id="su-last" name="last" label="Last name" autoComplete="family-name" placeholder="Last" disabled={!configured} />
      </div>
      <Field
        id="su-email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="example@gmail.com"
        error={fieldErrors.email}
        disabled={!configured}
      />
      <div>
        <PasswordField
          id="su-pw"
          label="Password"
          autoComplete="new-password"
          value={pw}
          onChange={setPw}
          describedBy="su-pw-help"
          invalid={Boolean(fieldErrors.password)}
          disabled={!configured}
        />
        <div aria-hidden="true" className={`meter tone-${strength.tone}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < strength.score ? "on" : undefined} />
          ))}
        </div>
        <p id="su-pw-help" className={pwWarn ? "field-error" : "field-hint"} aria-live="polite">
          {pwMessage || "At least 8 characters."}
        </p>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={disabled}>
        {busy ? "Creating account" : "Continue"}
      </button>
      <p className="fine agree">
        By creating an account you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </form>
  );
}
