// Server components for the two Gmail connection states an /app page can be in.
// Plain <a>, not <Link>: the target is a route handler that redirects to Google.

export const CONNECT_HREF = "/api/auth/google?next=app";

/** A signed-in user who has not connected Gmail yet: shown instead of the page's content. */
export function ConnectGmailEmpty({ title }: { title: string }) {
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
    <div role="status" className="notice-bar warn reconnect-bar">
      <span>Your Gmail connection expired. Reconnect to keep your list up to date.</span>
      <a href={CONNECT_HREF} className="btn btn-primary btn-sm">
        Reconnect Gmail
      </a>
    </div>
  );
}
