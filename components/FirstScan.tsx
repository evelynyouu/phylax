"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Progress {
  running: boolean;
  listed: number;
  checked: number;
  processed: number;
  error: string | null;
  found: { subscriptions: number; bills: number };
}

/** Sign-up step 3: starts the first sync and polls GET /api/sync for real progress. */
export default function FirstScan() {
  const [p, setP] = useState<Progress | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let stop = false;

    async function poll() {
      while (!stop) {
        try {
          const res = await fetch("/api/sync", { cache: "no-store" });
          if (res.ok) setP(await res.json());
        } catch {
          // Keep polling; the POST below reports real failures.
        }
        await new Promise((r) => setTimeout(r, 700));
      }
    }

    poll();
    fetch("/api/sync", { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (data.error === "reconnect") throw new Error("Google did not accept the Gmail connection. Connect Gmail again from your dashboard.");
        // Otherwise 409 means a sync is already running; the poll keeps tracking it.
        if (!res.ok && res.status !== 409) throw new Error(data.error ?? "The scan failed");
        if (res.status === 409) {
          while (!stop) {
            const r = await fetch("/api/sync", { cache: "no-store" });
            const s: Progress = await r.json();
            if (!s.running) break;
            await new Promise((x) => setTimeout(x, 700));
          }
        }
        const r = await fetch("/api/sync", { cache: "no-store" });
        if (r.ok) setP(await r.json());
        setDone(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "The scan failed"))
      .finally(() => {
        stop = true;
      });

    return () => {
      stop = true;
    };
  }, []);

  const pct = done ? 100 : p && p.listed > 0 ? Math.round((p.checked / p.listed) * 100) : null;

  const R = 58;
  const C = 2 * Math.PI * R;
  return (
    <>
      <div
        className={`scan-ring${pct === null ? " indeterminate" : ""}`}
        role="progressbar"
        aria-label="First scan"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-valuetext={pct === null ? "Finding billing email" : `${pct}%`}
      >
        <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
          <circle cx="66" cy="66" r={R} fill="none" stroke="var(--hairline)" strokeWidth="10" />
          <circle
            className="arc"
            cx="66"
            cy="66"
            r={R}
            fill="none"
            stroke="var(--sage)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C.toFixed(1)}
            strokeDashoffset={(C * (1 - (pct ?? 25) / 100)).toFixed(1)}
            transform="rotate(-90 66 66)"
          />
        </svg>
        <span aria-hidden="true">
          {done ? (
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--evergreen)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L19 7" />
            </svg>
          ) : pct === null ? (
            ""
          ) : (
            `${pct}%`
          )}
        </span>
      </div>
      <h1>{done ? "Your garden is ready" : "Scanning your inbox"}</h1>
      <p className="lede">{done ? "Here is what Phylax found in your billing email." : "Reading billing email from the last 13 months. It takes about a minute."}</p>
      <div aria-live="polite" className="scan-stats">
        <div>
          <span>{p?.checked ?? 0}</span>
          <span>emails read</span>
        </div>
        <div>
          <span>{p?.found.subscriptions ?? 0}</span>
          <span>subscriptions</span>
        </div>
        <div>
          <span>{p?.found.bills ?? 0}</span>
          <span>bills due</span>
        </div>
      </div>
      {error && (
        <p role="alert" className="auth-msg">
          {error}
        </p>
      )}
      {(done || error) && (
        <Link href="/app" className="btn btn-primary btn-block auth-cta">
          Open my dashboard
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      )}
    </>
  );
}
