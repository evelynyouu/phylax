"use client";

import { useState } from "react";
import { authErrorMessage } from "@/lib/auth-copy";
import type { AppUser } from "@/lib/current-user";
import { hasPassword, validateNewEmail } from "@/lib/profile";
import { supabaseBrowser } from "@/lib/supabase/browser";

const NOTICES = {
  pending: "One link confirmed. Open the link sent to your other address to finish.",
  changed: "Your email is updated.",
} as const;

export default function EmailSection({ user, notice }: { user: AppUser; notice?: string | null }) {
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSent("");
    const bad = validateNewEmail(user.email, next);
    if (bad) {
      setError(bad);
      return;
    }
    setError("");
    setBusy(true);
    const address = next.trim();
    try {
      const { error: err } = await supabaseBrowser().auth.updateUser(
        { email: address },
        { emailRedirectTo: `${window.location.origin}/auth/callback?next=/app/settings` },
      );
      if (err) {
        setError(authErrorMessage(err.message, err.code));
        return;
      }
      setSent(`We sent a confirmation link to ${address}. Your email changes after you open it. Supabase may also ask you to confirm from your current address.`);
      setNext("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="set-email">
      <h2 id="set-email">Email</h2>
      <p>{user.email}</p>
      {notice === "pending" || notice === "changed" ? <p role="status">{NOTICES[notice]}</p> : null}
      {hasPassword(user) ? (
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="set-new-email">New email</label>
            <input id="set-new-email" type="email" autoComplete="email" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={error ? true : undefined} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Send verification
          </button>
          <p className={error ? "field-error" : "field-hint"} role={error ? "alert" : "status"}>
            {error || sent}
          </p>
        </form>
      ) : (
        <p className="field-hint">You sign in with Google, so your email comes from your Google account.</p>
      )}
    </section>
  );
}
