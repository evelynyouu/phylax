import { Suspense } from "react";
import CalendarView from "@/components/CalendarView";
import { ConnectGmailEmpty } from "@/components/ConnectGmail";
import { loadApp } from "@/lib/app-data";

export const metadata = { title: "Calendar | Phylax" };

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="page-head"><h1>Calendar</h1></div>}>
      <Calendar />
    </Suspense>
  );
}

async function Calendar() {
  const { dashboard, today, gmail } = await loadApp();
  if (gmail === "connect") return <ConnectGmailEmpty title="Calendar" />;
  return <CalendarView subscriptions={dashboard.subscriptions} bills={dashboard.bills} receipts={dashboard.receipts} today={today} />;
}
