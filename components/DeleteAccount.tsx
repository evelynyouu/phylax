"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function DeleteAccount() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function open() {
    setText("");
    setError("");
    dialog.current?.showModal();
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "delete" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not delete your account. Please try again.");
        return;
      }
      dialog.current?.close();
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not delete your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="linkish quiet" style={{ fontSize: 13, alignSelf: "flex-start" }} onClick={open}>
        Delete account
      </button>
      <dialog ref={dialog} className="confirm-dialog" aria-labelledby="delete-h">
        <form
          method="dialog"
          className="confirm-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (text === "delete" && !busy) void remove();
          }}
        >
          <h2 id="delete-h">Delete account</h2>
          <p>This deletes your Phylax account and everything it found. Your Gmail is not touched.</p>
          <label>
            Type <strong>delete</strong> to confirm
            <input type="text" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
          </label>
          {error && <p role="alert">{error}</p>}
          <div className="confirm-actions">
            <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={text !== "delete" || busy}>
              Delete account
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
