// Server components for the Gmail connection states an /app page can be in (lib/views.ts gmailState).
// Every Connect or Reconnect button goes to /connect-gmail first, which shows what Subwatch does
// with Gmail before Google's consent screen.

import type { GmailState } from "@/lib/views";

export const CONNECT_HREF = "/connect-gmail?next=app";

/**
 * A signed-in user with no Gmail connection and nothing found yet: shown instead of the page's
 * content. `message` is why the last Connect Gmail attempt failed, if it did.
 */
export function ConnectGmailEmpty({ title, message }: { title: string; message?: string | null }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
        </div>
      </div>
      <section aria-labelledby="connect-h" className="empty-card">
        <h2 id="connect-h" className="display">
          Connect Gmail to get started
        </h2>
        {message && (
          <p role="alert" className="auth-msg">
            {message}
          </p>
        )}
        <p className="empty-body">Subwatch reads billing email from the last 13 months. It never stores the text of your emails.</p>
        <div className="empty-actions">
          <a href={CONNECT_HREF} className="btn btn-primary">
            Connect Gmail
          </a>
        </div>
      </section>
    </>
  );
}

/** Google refused the stored token. Existing records stay on screen below this. */
export function ReconnectNotice() {
  return (
    <div role="status" className="notice-bar warn reconnect-bar app-notice">
      <span>Your Gmail connection expired. Reconnect to keep your list up to date.</span>
      <a href={CONNECT_HREF} className="btn btn-primary btn-sm">
        Reconnect Gmail
      </a>
    </div>
  );
}

/** Gmail was disconnected, but records found before stay on screen below this. */
export function DisconnectedNotice() {
  return (
    <div role="status" className="notice-bar reconnect-bar app-notice">
      <span>Gmail is not connected. You are seeing what Subwatch found before. Connect Gmail to keep it up to date.</span>
      <a href={CONNECT_HREF} className="btn btn-primary btn-sm">
        Connect Gmail
      </a>
    </div>
  );
}

/** The notice, if any, above every /app page for this Gmail state. Rendered once, in app/app/layout.tsx. */
export function GmailNotice({ state }: { state: GmailState }) {
  if (state === "reconnect") return <ReconnectNotice />;
  if (state === "disconnected") return <DisconnectedNotice />;
  return null;
}
