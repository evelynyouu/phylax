"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DisconnectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    if (!window.confirm("Disconnect Gmail? Subwatch will stop reading your inbox. Saved results stay on this computer.")) return;
    setBusy(true);
    try {
      await fetch("/api/auth/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn btn-quiet" onClick={disconnect} disabled={busy}>
      Disconnect Gmail
    </button>
  );
}
