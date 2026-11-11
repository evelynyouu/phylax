"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AUTH_MESSAGES, authErrorMessage, PASSWORD_HINT, validateSignup, type SignupErrors } from "@/lib/auth-copy";
import { supabaseEnv } from "@/lib/supabase/config";
import { supabaseBrowser } from "@/lib/supabase/browser";
import GoogleIcon from "./GoogleIcon";
import { Field } from "./ui";

const NEXT = { signin: "/app", signup: "/signup?step=2" } as const;

function callbackUrl(next: string): string {
  // The PKCE code verifier cookie lives on this origin, so the callback must too.
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

/**
 * Email and password plus Google, for sign-in and sign-up step 1. Errors show inline.
 * In demo mode it never creates a Supabase client; every path just moves on.
 */
export default function AuthForm({ mode, demo = false }: { mode: "signin" | "signup"; demo?: boolean }) {
  const next = NEXT[mode];
  const configured = demo || supabaseEnv() !== null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignupErrors>({});

  async function google() {
    setError("");
    if (demo) return window.location.assign(next);
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(next) },
    });
    // On success the browser is already leaving for Google.
    if (error) {
      setError(authErrorMessage(error.message));
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
    const name = String(form.get("name") ?? "").trim();

    if (mode === "signup") {
      const errors = validateSignup({ name, email, password });
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }
    if (demo) return window.location.assign(next);

    setBusy(true);
    try {
      const auth = supabaseBrowser().auth;
      if (mode === "signin") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) return setError(authErrorMessage(error.message));
        return window.location.assign(next);
      }
      const { data, error } = await auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: callbackUrl(next) },
      });
      if (error) return setError(authErrorMessage(error.message));
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

  if (mode === "signin") {
    return (
      <>
        {messages}
        {demo ? (
          <Link href="/app" className="btn btn-primary btn-google" style={{ background: "var(--evergreen)", color: "#fff", borderColor: "var(--evergreen)" }}>
            Open the demo
          </Link>
        ) : (
          <button type="button" className="btn btn-google" onClick={google} disabled={disabled}>
            <GoogleIcon />
            Continue with Google
          </button>
        )}
        <p className="or">or use email</p>
        <form onSubmit={submit}>
          <div className="stack-16">
            <Field id="si-email" name="email" label="Email" type="email" autoComplete="email" placeholder="you@berkeley.edu" required disabled={!configured} />
            <Field id="si-pw" name="password" label="Password" type="password" autoComplete="current-password" required disabled={!configured} />
          </div>
          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 26 }} disabled={disabled}>
            {busy ? "Signing in" : "Sign in"}
          </button>
        </form>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      {messages}
      <div className="su-fields">
        <Field id="su-name" name="name" label="Name" autoComplete="name" placeholder="Evelyn You" error={fieldErrors.name} disabled={!configured} />
        <Field id="su-email" name="email" label="Email" type="email" autoComplete="email" placeholder="you@berkeley.edu" error={fieldErrors.email} disabled={!configured} />
      </div>
      <div style={{ marginTop: 18 }}>
        <Field
          id="su-pw"
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          error={fieldErrors.password}
          disabled={!configured}
        />
      </div>
      <div className="su-actions">
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          {busy ? "Creating account" : "Create account"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={google} disabled={disabled}>
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </form>
  );
}
