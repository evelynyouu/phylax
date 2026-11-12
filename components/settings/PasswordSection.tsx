"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authErrorMessage, passwordStrength, PASSWORD_HINT } from "@/lib/auth-copy";
import type { AppUser } from "@/lib/current-user";
import { hasPassword } from "@/lib/profile";
import { supabaseBrowser } from "@/lib/supabase/browser";
import PasswordField from "../PasswordField";

export default function PasswordSection({ user }: { user: AppUser }) {
  const router = useRouter();
  const has = hasPassword(user);
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const strength = passwordStrength(pw);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone("");
    if (pw.length < 8) {
      setError(PASSWORD_HINT);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const supabase = supabaseBrowser();
      if (has) {
        const { error: err } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
        if (err) {
          setError(err.code === "invalid_credentials" ? "Your current password is wrong." : authErrorMessage(err.message, err.code));
          return;
        }
      }
      const { error: err } = await supabase.auth.updateUser({ password: pw });
      if (err) {
        setError(authErrorMessage(err.message, err.code));
        return;
      }
      setDone("Password changed.");
      setCurrent("");
      setPw("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="set-password">
      <h2 id="set-password">{has ? "Password" : "Set a password"}</h2>
      <form onSubmit={submit} noValidate>
        {has && <PasswordField id="set-current-pw" label="Current password" autoComplete="current-password" value={current} onChange={setCurrent} disabled={busy} />}
        <PasswordField id="set-new-pw" label="New password" autoComplete="new-password" value={pw} onChange={setPw} describedBy="set-pw-help" disabled={busy} />
        <div aria-hidden="true" className={`meter tone-${strength.tone}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < strength.score ? "on" : undefined} />
          ))}
        </div>
        <p id="set-pw-help" className={error ? "field-error" : "field-hint"} role={error ? "alert" : "status"}>
          {error || done || strength.text || PASSWORD_HINT}
        </p>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {has ? "Change password" : "Set password"}
        </button>
      </form>
    </section>
  );
}
