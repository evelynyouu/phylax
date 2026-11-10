import { connection } from "next/server";
import { Suspense } from "react";
import CancelAction from "@/components/CancelAction";
import DisconnectButton from "@/components/DisconnectButton";
import StopTracking from "@/components/StopTracking";
import SyncButton from "@/components/SyncButton";
import Tape from "@/components/Tape";
import { todayIso } from "@/lib/extract/dates";
import { cadenceLabel, money, relDays, shortDate } from "@/lib/format";
import { getDashboard } from "@/lib/sync";
import type { DueItem, Subscription, UpcomingPayment } from "@/lib/types";


const AUTH_MESSAGES: Record<string, string> = {
  not_configured: "Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as described in the README, or run npm run demo for sample data.",
  denied: "Google sign-in was cancelled. Connect Gmail to try again.",
  invalid_state: "The sign-in could not be verified. Connect Gmail to try again.",
  failed: "Google sign-in failed. Check the OAuth settings in the README and try again.",
};

function priceNote(s: Subscription, today: string): string | null {
  const pc = s.priceChange;
  if (!pc) return null;
  const refYear = Number(today.slice(0, 4));
  const future = pc.effective !== null && pc.effective >= today;
  if (future) {
    const when = shortDate(pc.effective!, refYear);
    return pc.from !== null
      ? `Price changes from ${money(pc.from)} to ${money(pc.to)} on ${when}`
      : `Price changing to ${money(pc.to)} on ${when}`;
  }
  if (pc.from === null) return null;
  return pc.to > pc.from
    ? `Price went up from ${money(pc.from)} to ${money(pc.to)}`
    : `Price dropped from ${money(pc.from)} to ${money(pc.to)}`;
}

function SubscriptionRow({ s, today }: { s: Subscription; today: string }) {
  const refYear = Number(today.slice(0, 4));
  const cadence = cadenceLabel(s.cadence);
  const note = priceNote(s, today);
  const daysAway = s.nextChargeDate
    ? Math.round((Date.parse(s.nextChargeDate) - Date.parse(today)) / 86400000)
    : null;

  return (
    <li className="row">
      <div>
        <p className="row-name">
          {s.merchant}
          {s.status === "trial" && <span className="tag tag-trial">Free trial</span>}
          {s.status === "cancelled" && <span className="tag tag-cancelled">Cancelled</span>}
        </p>
        <p className="row-meta">{[money(s.amount, s.currency), cadence].filter(Boolean).join(" ")}</p>
        {note && <p className="notice">{note}</p>}
      </div>
      <div className="row-next">
        {s.status === "cancelled" ? (
          <span className="muted">{s.lastChargeDate ? `Last charged ${shortDate(s.lastChargeDate, refYear)}` : "No more charges"}</span>
        ) : s.nextChargeDate ? (
          <>
            {shortDate(s.nextChargeDate, refYear)}
            <small>{daysAway !== null ? relDays(daysAway) : ""}</small>
          </>
        ) : (
          <span className="muted">Next date unknown</span>
        )}
      </div>
      <div className="row-actions">
        {s.status !== "cancelled" &&
          (s.cancelUrl ? (
            <CancelAction
              url={s.cancelUrl}
              trusted={s.cancelUrlTrusted}
              merchant={s.merchant}
              label={s.status === "trial" ? "Cancel trial" : "Cancel subscription"}
            />
          ) : (
            <span className="muted">No cancel link in your emails</span>
          ))}
        <StopTracking merchantKey={s.merchantKey} merchant={s.merchant} />
      </div>
    </li>
  );
}

function DeadlineRow({ d, today }: { d: DueItem; today: string }) {
  const refYear = Number(today.slice(0, 4));
  const urgency = d.daysAway < 0 ? "late" : d.daysAway <= 3 ? "soon" : "";
  const label = d.kind === "trial_ending" ? "Cancel trial" : "Cancel before renewal";
  return (
    <li className="deadline">
      <div>
        <p className="deadline-what">
          {d.merchant}: {d.label.toLowerCase()}
        </p>
        <p className={`deadline-when ${urgency}`}>
          {shortDate(d.date, refYear)}, {d.daysAway < 0 ? `${-d.daysAway} days overdue` : relDays(d.daysAway)}
        </p>
      </div>
      <div className="deadline-amt">{d.amount !== null ? money(d.amount, d.currency) : ""}</div>
      {d.kind !== "payment_due" && d.cancelUrl && (
        <div className="deadline-act">
          <CancelAction url={d.cancelUrl} trusted={d.cancelUrlTrusted} merchant={d.merchant} label={label} />
        </div>
      )}
    </li>
  );
}

function groupByWeek(items: UpcomingPayment[]): { title: string; items: UpcomingPayment[] }[] {
  const buckets = [
    { title: "This week", test: (n: number) => n < 7 },
    { title: "Next week", test: (n: number) => n >= 7 && n < 14 },
    { title: "In two to four weeks", test: (n: number) => n >= 14 && n < 30 },
    { title: "Later", test: (n: number) => n >= 30 },
  ];
  return buckets
    .map((b) => ({ title: b.title, items: items.filter((i) => b.test(i.daysAway)) }))
    .filter((b) => b.items.length > 0);
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// The page shell prerenders. Everything that reads the database, the clock, or the URL runs at request time.
export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <header className="top">
            <h1 className="brand">Subwatch</h1>
            <span className="status-line" role="status">
              Loading
            </span>
          </header>
        </main>
      }
    >
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const sp = await searchParams;
  const { dashboard, source, connected } = await getDashboard();
  const today = process.env.SUBWATCH_TODAY ?? todayIso();
  const refYear = Number(today.slice(0, 4));
  const authParam = typeof sp.auth === "string" ? sp.auth : undefined;
  const banner = authParam ? AUTH_MESSAGES[authParam] : undefined;

  const { subscriptions, upcoming, due, totals } = dashboard;
  const live = subscriptions.filter((s) => s.status !== "cancelled");
  const cancelled = subscriptions.filter((s) => s.status === "cancelled");
  const next30 = upcoming.filter((u) => u.daysAway <= 30);
  const total30 = next30.reduce((sum, u) => sum + (u.amount ?? 0), 0);
  const isEmpty = subscriptions.length === 0 && due.length === 0 && upcoming.length === 0;

  return (
    <main className="shell">
      <header className="top">
        <h1 className="brand">Subwatch</h1>
        <div className="top-actions">
          {source === "fixtures" && <span className="status-line">Sample data</span>}
          {connected && <SyncButton label={isEmpty ? "Scan inbox" : "Sync now"} />}
          {connected && source === "gmail" && <DisconnectButton />}
        </div>
      </header>

      {banner && <p className="banner" role="alert">{banner}</p>}

      {!connected ? (
        <section className="empty-state">
          <h2>Find every subscription in your inbox</h2>
          <p>
            Connect Gmail with read-only access. Subwatch looks for receipts, renewal notices, and bills, then shows
            what you pay for, when it renews, and where to cancel.
          </p>
          <a className="btn" href="/api/auth/google">
            Connect Gmail
          </a>
        </section>
      ) : isEmpty ? (
        <section className="empty-state">
          <h2>Nothing found yet</h2>
          <p>Scan your inbox for receipts, renewal notices, and bills. The first scan reads the last 13 months.</p>
        </section>
      ) : (
        <>
          <section className="hero" aria-labelledby="hero-title">
            <h2 id="hero-title" className="hero-figure">
              {money(Math.round(total30 * 100) / 100)}
            </h2>
            <p className="hero-sub">
              leaves your account in the next 30 days across {next30.length} {next30.length === 1 ? "payment" : "payments"}.
              Your subscriptions cost {money(totals.monthly)} a month, or {money(totals.yearly)} a year.
            </p>
            <Tape upcoming={upcoming} today={today} />
          </section>

          <div className="grid">
            <section aria-labelledby="subs-title">
              <h2 id="subs-title" className="section-title">
                Subscriptions
              </h2>
              <p className="section-note">
                {live.length} active or on trial. Cancel links come from the emails these companies sent you.
              </p>
              <div className="panel">
                <ul className="rows">
                  {live.map((s) => (
                    <SubscriptionRow key={s.merchantKey} s={s} today={today} />
                  ))}
                </ul>
              </div>
              {cancelled.length > 0 && (
                <details className="cancelled">
                  <summary>{cancelled.length} cancelled</summary>
                  <div className="panel">
                    <ul className="rows">
                      {cancelled.map((s) => (
                        <SubscriptionRow key={s.merchantKey} s={s} today={today} />
                      ))}
                    </ul>
                  </div>
                </details>
              )}
            </section>

            <div className="stack">
              <section aria-labelledby="due-title">
                <h2 id="due-title" className="section-title">
                  Deadlines
                </h2>
                <p className="section-note">Bills to pay, trials about to convert, and renewals you can still stop.</p>
                <div className="panel">
                  {due.length === 0 ? (
                    <p className="muted" style={{ padding: 18 }}>
                      Nothing is due soon.
                    </p>
                  ) : (
                    <ul className="rows">
                      {due.map((d) => (
                        <DeadlineRow key={`${d.merchant}-${d.kind}-${d.date}`} d={d} today={today} />
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section aria-labelledby="up-title">
                <h2 id="up-title" className="section-title">
                  Coming up
                </h2>
                <p className="section-note">Every expected charge over the next 60 days.</p>
                <div className="panel" style={{ paddingBottom: 10 }}>
                  {upcoming.length === 0 ? (
                    <p className="muted" style={{ padding: 18 }}>
                      No charges expected in the next 60 days.
                    </p>
                  ) : (
                    groupByWeek(upcoming).map((g) => (
                      <div className="week" key={g.title}>
                        <h3>{g.title}</h3>
                        {g.items.map((p) => (
                          <div
                            key={`${p.merchant}-${p.date}-${p.source}`}
                            className={`pay ${p.source === "bill" ? "pay-bill" : ""}`}
                          >
                            <span className="pay-date">{shortDate(p.date, refYear)}</span>
                            <span className="pay-name">{p.merchant}</span>
                            <span>{money(p.amount, p.currency)}</span>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      )}

      <p className="foot">
        Subwatch has read-only access to Gmail and cannot send, change, or delete mail. It saves the merchant, amount,
        date, and cancel link from each billing email on this computer, not the email text.
      </p>
    </main>
  );
}
