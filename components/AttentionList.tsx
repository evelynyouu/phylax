"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { AttentionItem } from "@/lib/views";

const STORE = "subwatch.dismissed-attention";

function readDismissed(): string {
  try {
    return localStorage.getItem(STORE) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(STORE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STORE, onChange);
  };
}

/** "Needs attention" with Dismiss. Dismissals are a per-browser convenience, kept in localStorage. */
export default function AttentionList({ items }: { items: AttentionItem[] }) {
  const raw = useSyncExternalStore(subscribe, readDismissed, () => "[]");
  let dismissed: string[] = [];
  try {
    dismissed = JSON.parse(raw);
  } catch {
    dismissed = [];
  }

  const save = (next: string[]) => {
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // Storage blocked: nothing to remember.
    }
    window.dispatchEvent(new Event(STORE));
  };
  const visible = items.filter((i) => !dismissed.includes(i.key));

  return (
    <section aria-labelledby="att-h" className="card grow-380">
      <div className="att-head">
        <h2 id="att-h">Needs attention</h2>
        {visible.length > 0 && <span>{visible.length} item{visible.length === 1 ? "" : "s"}</span>}
      </div>
      {visible.length > 0 ? (
        <ul className="list-plain att-list">
          {visible.map((a) => (
            <li key={a.key} className="att-item">
              <span aria-hidden="true" className="dot" style={{ background: a.urgent ? "var(--mauve)" : "var(--sky)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="title">{a.title}</p>
                <p className={`sub${a.urgent ? " urgent" : ""}`}>{a.sub}</p>
                <div className="att-actions">
                  <Link href={a.href}>{a.action}</Link>
                  <button type="button" className="linkish quiet" onClick={() => save([...dismissed, a.key])}>
                    Dismiss
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ marginTop: 14, fontSize: 15, color: "var(--moss)" }}>
          Nothing needs you right now.{" "}
          {dismissed.length > 0 && items.length > 0 && (
            <button type="button" className="linkish" onClick={() => save([])}>
              Show dismissed
            </button>
          )}
        </p>
      )}
    </section>
  );
}
