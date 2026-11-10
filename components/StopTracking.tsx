"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StopTracking({ merchantKey, merchant }: { merchantKey: string; merchant: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function hide() {
    setBusy(true);
    try {
      await fetch("/api/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantKey }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn-link" onClick={hide} disabled={busy} aria-label={`Stop tracking ${merchant}`}>
      Stop tracking
    </button>
  );
}
