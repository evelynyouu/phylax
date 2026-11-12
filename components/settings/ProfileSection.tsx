"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { AppUser } from "@/lib/current-user";
import { validateName } from "@/lib/profile";
import { supabaseBrowser } from "@/lib/supabase/browser";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export default function ProfileSection({ user, avatarUrl }: { user: AppUser; avatarUrl: string | null }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    const bad = validateName(name);
    if (bad) {
      setError(bad);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { error: err } = await supabaseBrowser().auth.updateUser({ data: { full_name: name.trim() } });
      if (err) {
        setError("Could not save your name. Please try again.");
        return;
      }
      setStatus("Name saved.");
      router.refresh();
    } catch {
      setError("Could not save your name. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(f: File) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const body = new FormData();
      body.append("file", f);
      const res = await fetch("/api/account/avatar", { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Use a PNG, JPEG or WebP image under 2 MB.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not upload that photo. Please try again.");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      if (!res.ok) {
        setError("Could not remove your photo. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not remove your photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="set-profile">
      <h2 id="set-profile">Profile</h2>
      <div className="photo-row">
        {avatarUrl ? (
          // Signed Supabase Storage URL that changes each render; next/image remote config is not wanted.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="avatar avatar-lg" />
        ) : (
          <span aria-hidden="true" className="avatar avatar-lg">
            {initials(user.name)}
          </span>
        )}
        <div className="photo-actions">
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            aria-label="Photo file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => file.current?.click()}>
            Upload photo
          </button>
          {avatarUrl && (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={remove}>
              Remove photo
            </button>
          )}
        </div>
      </div>
      <form onSubmit={saveName} noValidate>
        <div className="field">
          <label htmlFor="set-name">Name</label>
          <input id="set-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={error ? true : undefined} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Save name
        </button>
      </form>
      <p className={error ? "field-error" : "field-hint"} role={error ? "alert" : "status"}>
        {error || status}
      </p>
    </section>
  );
}
