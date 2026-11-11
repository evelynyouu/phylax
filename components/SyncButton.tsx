"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SyncButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sync() {
    setState("syncing");
    setMessage("");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (res.status === 409 && data.error === "reconnect") {
        // The dashboard's reconnect notice takes it from here.
        setState("error");
        setMessage("Gmail needs reconnecting");
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setState("done");
      setMessage(data.processed === 0 ? "Up to date" : `Read ${data.processed} new emails`);
      router.refresh();
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "Sync failed");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span role="status" aria-live="polite" className={state === "error" ? "field-error" : "muted"} style={{ fontSize: 14 }}>
        {state === "syncing" ? "Reading your inbox" : message}
      </span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={sync} disabled={state === "syncing"}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 12a8 8 0 1 1-2.3-5.7" />
          <path d="M20 4v5h-5" />
        </svg>
        {state === "syncing" ? "Syncing" : "Sync now"}
      </button>
    </div>
  );
}
