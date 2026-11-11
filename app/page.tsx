import Link from "next/link";
import LandingHero from "@/components/LandingHero";
import { isDemo } from "@/lib/session";

// Static marketing page. The hero's petals map to a sample inbox: the visitor is not signed in.

const BARS = [30, 18, 62, 22, 14, 40, 26, 90, 20, 34, 16, 48, 28, 70, 18, 24, 52, 12, 36, 44, 20, 58, 16, 30];
const MARKS: Record<number, string> = { 1: "var(--sage)", 4: "var(--mauve)", 8: "var(--sage)", 11: "var(--sky)", 13: "var(--sage)", 17: "var(--mauve)", 19: "var(--sage)", 20: "var(--sky)", 24: "var(--sage)", 27: "var(--mauve)", 30: "var(--sage)" };

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <g fill="none" stroke="#344C3D" strokeWidth="2">
        <path d="M16 16c-4-6-4-11 0-13 4 2 4 7 0 13z" fill="#D8959B" />
        <path d="M16 16c6-4 11-4 13 0-2 4-7 4-13 0z" fill="#D0DBE7" />
        <path d="M16 16c4 6 4 11 0 13-4-2-4-7 0-13z" fill="#E3DADE" />
        <path d="M16 16c-6 4-11 4-13 0 2-4 7-4 13 0z" fill="#829672" />
      </g>
    </svg>
  );
}

export default function Home() {
  // In demo mode the dashboard is sample data anyone can open; otherwise it is the signed-in user's real data.
  const demo = isDemo();
  return (
    <div className="landing">
      <header className="l-head">
        <Link href="/" className="l-brand">
          <Logo />
          <span>Subwatch</span>
        </Link>
        <nav aria-label="Main" className="l-nav">
          <a className="navlink" href="#how">
            How it works
          </a>
          <a className="navlink" href="#privacy">
            Privacy
          </a>
          <Link className="navlink keep" href="/signin">
            Sign in
          </Link>
          <Link className="btn btn-primary" href="/signup">
            Get started
          </Link>
        </nav>
      </header>

      <main>
        <LandingHero sampleHref={demo ? "/app" : "#see"} sampleLabel={demo ? "See a sample dashboard" : "See what you'll get"} />

        <section id="how" aria-labelledby="how-h" className="how">
          <div className="l-section">
            <h2 id="how-h" className="l-h2" style={{ maxWidth: "16em" }}>
              Three steps from a messy inbox to a clear list
            </h2>
            <ol>
              <li>
                <span className="num" aria-hidden="true">1</span>
                <h3>Connect Gmail</h3>
                <p>Sign in with Google and grant read-only access. Subwatch only looks at billing emails: receipts, invoices, renewal notices and trial reminders.</p>
              </li>
              <li>
                <span className="num" aria-hidden="true">2</span>
                <h3>We find what repeats</h3>
                <p>Charges are matched to the company that sent them, grouped into subscriptions and bills, and checked for price changes and trials about to convert.</p>
              </li>
              <li>
                <span className="num" aria-hidden="true">3</span>
                <h3>Keep or cancel</h3>
                <p>See what is due and when, then cancel straight from the link in the company&apos;s own email. Subwatch warns you if a link points anywhere else.</p>
              </li>
            </ol>
          </div>
        </section>

        <section id="see" aria-labelledby="see-h" className="l-section">
          <h2 id="see-h" className="l-h2">
            What you&apos;ll see
          </h2>
          <div className="tiles-grid">
            <Link className="ltile" href="/app" style={{ background: "var(--surface)" }}>
              <div className="art" aria-hidden="true">
                {BARS.map((h, i) => (
                  <span key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "3px 3px 0 0", background: h > 60 ? "var(--mauve)" : i % 3 === 0 ? "var(--sage)" : "var(--sky)" }} />
                ))}
              </div>
              <div>
                <h3>Dashboard</h3>
                <p>Everything leaving your account in the next 30 days, and what your subscriptions cost a month.</p>
              </div>
            </Link>
            <Link className="ltile" href="/app/recurring" style={{ background: "var(--lavender)" }}>
              <div className="art rows" aria-hidden="true">
                {[["var(--mauve)", "Netflix", "$15.49"], ["var(--evergreen)", "ChatGPT Plus", "$20"], ["var(--sky)", "Dropbox Plus", "$119.88"], ["var(--evergreen)", "GitHub Copilot", "$10"]].map(([c, n, a]) => (
                  <div key={n}>
                    <span style={{ width: 14, height: 14, borderRadius: "5px 5px 5px 1px", background: c }} />
                    <span>{n}</span>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3>Recurring</h3>
                <p>Subscriptions grouped by category, with the cancel link from each company&apos;s own email.</p>
              </div>
            </Link>
            <Link className="ltile" href="/app/calendar" style={{ background: "var(--sky)" }}>
              <div className="art cal" aria-hidden="true">
                {Array.from({ length: 35 }, (_, d) => (
                  <span key={d} style={{ background: MARKS[d] ?? "#f1ecef" }} />
                ))}
              </div>
              <div>
                <h3>Calendar</h3>
                <p>Every charge and due date on a month view, so the heavy weeks don&apos;t surprise you.</p>
              </div>
            </Link>
            <Link className="ltile" href="/app/bills" style={{ background: "var(--surface)" }}>
              <div className="art rows" aria-hidden="true">
                {[["Hulu trial ends", "in 3 days"], ["PG&E bill due", "in 11 days"], ["Adobe auto-renews", "in 22 days"]].map(([n, w]) => (
                  <div key={n} style={{ background: "var(--paper)", justifyContent: "space-between" }}>
                    <span>{n}</span>
                    <span style={{ color: "var(--mauve-ink)", flex: "none" }}>{w}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3>Bills and deadlines</h3>
                <p>Bills to pay, free trials about to convert, and renewals you can still stop.</p>
              </div>
            </Link>
          </div>
        </section>

        <section id="privacy" aria-labelledby="privacy-h" className="privacy">
          <div className="l-section">
            <div className="lead">
              <h2 id="privacy-h" className="l-h2">
                Your email stays your email
              </h2>
              <p>Subwatch is built to read as little as it can and keep even less.</p>
            </div>
            <ul>
              <li>
                <h3>Read-only Gmail access</h3>
                <p>It can&apos;t send, label, archive or delete anything. Disconnect at any time and access is revoked.</p>
              </li>
              <li>
                <h3>No email text stored</h3>
                <p>Only the merchant, amount, dates and cancel link from each billing email are saved.</p>
              </li>
              <li>
                <h3>Look-alike senders ignored</h3>
                <p>An email that claims to be Netflix but comes from another domain never reaches your list.</p>
              </li>
              <li>
                <h3>Cancel links checked</h3>
                <p>A link that leaves the sender&apos;s own website shows you the real address before it opens.</p>
              </li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="cta-h" className="l-section cta">
          <h2 id="cta-h" className="l-h2">
            Find out what you&apos;re paying for
          </h2>
          <p>The first scan reads the last 13 months of billing email. It takes about a minute.</p>
          <Link className="btn btn-primary" href="/signup">
            Get started
          </Link>
        </section>
      </main>

      <footer className="l-foot">
        <div>
          <span>
            <span className="display" style={{ fontSize: 18, color: "var(--ink)" }}>Subwatch</span> is a student project and isn&apos;t affiliated with Google.
          </span>
          <nav aria-label="Footer">
            <Link href="/signin">Sign in</Link>
            <a href="#privacy">Privacy</a>
            <Link href="/style">Style guide</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
