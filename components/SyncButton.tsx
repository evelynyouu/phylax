"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SyncButton({ label = "Sync now" }: { label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sync() {
    setState("syncing");
    setMessage("");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setState("done");
      setMessage(data.processed === 0 ? "Already up to date" : `Read ${data.processed} new emails`);
      router.refresh();
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "Sync failed");
    }
  }

  return (
    <>
      <span className="status-line" role="status" aria-live="polite">
        {state === "syncing" ? "Reading your inbox" : message}
      </span>
      <button type="button" className="btn" onClick={sync} disabled={state === "syncing"}>
        {state === "syncing" ? "Syncing" : label}
      </button>
    </>
  );
}
