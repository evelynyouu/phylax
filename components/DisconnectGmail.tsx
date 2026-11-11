"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DisconnectGmail() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function disconnect() {
    if (!window.confirm("Disconnect Gmail? Subwatch revokes its access. What it already found stays in your account until you delete the account.")) return;
    setBusy(true);
    try {
      await fetch("/api/auth/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" className="linkish quiet" style={{ fontSize: 13, alignSelf: "flex-start" }} onClick={disconnect} disabled={busy}>
      Disconnect Gmail
    </button>
  );
}
