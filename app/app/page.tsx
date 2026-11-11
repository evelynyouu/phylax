import Link from "next/link";
import { Suspense } from "react";
import AttentionList from "@/components/AttentionList";
import DashboardChart from "@/components/DashboardChart";
import { ConnectGmailEmpty } from "@/components/ConnectGmail";
import SyncButton from "@/components/SyncButton";
import { loadApp } from "@/lib/app-data";
import { GMAIL_MESSAGES } from "@/lib/auth-copy";
import { addDays } from "@/lib/extract/dates";
import { longDate, money } from "@/lib/format";
import { attentionItems, categoryTotals, dailySeries } from "@/lib/views";

export const metadata = { title: "Dashboard | Subwatch" };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BAR: Record<string, string> = {
  software: "var(--bar-software)",
  streaming: "var(--bar-streaming)",
  learning: "var(--bar-learning)",
  storage: "var(--bar-storage)",
  shopping: "var(--bar-shopping)",
  other: "var(--bar-other)",
};

export default function DashboardPage({ searchParams }: PageProps<"/app">) {
  return (
    <Suspense fallback={<PageHead title="Dashboard" eyebrow="Loading" />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

function PageHead({ title, eyebrow, action }: { title: string; eyebrow: string; action?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/app">["searchParams"] }) {
  const { dashboard: d, today, gmail } = await loadApp();
  // Set by the Connect Gmail callback when connecting failed (lib/auth-copy.ts gmailFailureRedirect).
  const code = (await searchParams).auth;
  const failure = typeof code === "string" ? (GMAIL_MESSAGES[code]?.text ?? null) : null;
  if (gmail === "connect") return <ConnectGmailEmpty title="Dashboard" message={failure} />;
  const series = dailySeries(d, today, 60);
  const active = d.subscriptions.filter((s) => s.status === "active").length;
  const trials = d.subscriptions.filter((s) => s.status === "trial").length;
  const weekEnd = addDays(today, 6);
  const week = d.upcoming.filter((u) => u.date <= weekEnd);
  const weekTotal = week.reduce((a, u) => a + (u.amount ?? 0), 0);
  const cats = categoryTotals(d);
  const catMax = cats[0]?.monthly ?? 1;

  return (
    <>
      <PageHead title="Dashboard" eyebrow={longDate(today)} action={<SyncButton />} />
      {failure && (
        <p role="alert" className="notice-bar warn">
          {failure}
        </p>
      )}

      {d.subscriptions.length === 0 && d.bills.length === 0 ? (
        <div className="empty-card">
          <p className="display">Nothing found yet</p>
          <p>Sync now to read your billing email. The first scan takes about a minute.</p>
        </div>
      ) : (
        <>
          <DashboardChart series={series} />

          <section aria-label="Subscription costs" className="cost-strip">
            <div>
              <p>Subscriptions a month</p>
              <p>{money(d.totals.monthly)}</p>
            </div>
            <div>
              <p>A year</p>
              <p>{money(d.totals.yearly)}</p>
            </div>
            <div>
              <p>Active</p>
              <p>
                {active}
                {trials > 0 ? ` + ${trials} trial${trials === 1 ? "" : "s"}` : ""}
              </p>
            </div>
            <div>
              <p>This week</p>
              <p>{money(weekTotal)}</p>
            </div>
          </section>

          <div className="row-wrap" style={{ marginTop: 16 }}>
            <AttentionList items={attentionItems(d, today)} />

            <div className="grow-340 stack-16">
              <section aria-labelledby="wk-h" className="card">
                <h2 id="wk-h">This week</h2>
                {week.length ? (
                  <ul className="list-plain week-list">
                    {week.map((u, i) => {
                      const [y, m, dd] = u.date.split("-").map(Number);
                      return (
                        <li key={`${u.merchantKey}-${u.date}-${i}`}>
                          <span className="when">
                            {DOW[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]} {dd}
                          </span>
                          <span className="name">{u.merchant}</span>
                          <span>{money(u.amount, u.currency)}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p style={{ marginTop: 12, color: "var(--moss)" }}>Nothing is charged this week.</p>
                )}
                <Link href="/app/calendar" className="more-link">
                  Open the calendar
                </Link>
              </section>

              <section aria-labelledby="cat-h" className="card">
                <h2 id="cat-h">By category, monthly</h2>
                <div className="cat-bars">
                  {cats.map((c) => (
                    <div key={c.category}>
                      <div className="top">
                        <span>{c.label}</span>
                        <span>{money(c.monthly)}</span>
                      </div>
                      <div className="cat-track">
                        <span style={{ width: `${Math.round((c.monthly / catMax) * 100)}%`, background: BAR[c.category] }} />
                      </div>
                    </div>
                  ))}
                  {cats.length === 0 && <p style={{ color: "var(--moss)" }}>No active subscriptions.</p>}
                </div>
                <Link href="/app/recurring" className="more-link">
                  See every subscription
                </Link>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}
