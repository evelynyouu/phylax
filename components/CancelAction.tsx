"use client";

import { useRef } from "react";

function safeHost(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/**
 * Opens the cancel link found in the user's own email.
 * Links on the sender's own domain open directly. Anything else asks first,
 * because a link that points somewhere other than the sender is the usual sign of phishing.
 */
export default function CancelAction({
  url,
  trusted,
  merchant,
  label = "Cancel subscription",
}: {
  url: string;
  trusted: boolean;
  merchant: string;
  label?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const host = safeHost(url);
  if (!host) return null;

  if (trusted) {
    return (
      <>
        <a className="btn btn-danger btn-row" href={url} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
        <span className="link-host">Opens {host}</span>
      </>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-danger btn-row" onClick={() => dialog.current?.showModal()}>
        {label}
      </button>
      <span className="link-host">Check link: {host}</span>
      <dialog ref={dialog} className="warn-dialog" aria-labelledby={`dlg-${merchant.replace(/[^a-z0-9]/gi, "")}`}>
        <h2 id={`dlg-${merchant.replace(/[^a-z0-9]/gi, "")}`}>This link is not on {merchant}&apos;s website</h2>
        <p>The email sent this cancel link to:</p>
        <p className="host-big">{host}</p>
        <p>
          It does not match the domain the email came from. Open it only if you recognize the site, and never enter a
          card number there.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost btn-row" onClick={() => dialog.current?.close()}>
            Go back
          </button>
          <a
            className="btn btn-danger btn-row"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => dialog.current?.close()}
          >
            Open link
          </a>
        </div>
      </dialog>
    </>
  );
}
