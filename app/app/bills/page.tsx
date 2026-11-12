import { Suspense } from "react";
import BillsView, { type BillRow, type PaidRow } from "@/components/BillsView";
import { ConnectGmailEmpty } from "@/components/ConnectGmail";
import { loadApp } from "@/lib/app-data";
import { money, shortDate } from "@/lib/format";
import { deadlineRows } from "@/lib/views";

export const metadata = { title: "Bills and deadlines | Phylax" };

export default function BillsPage() {
  return (
    <Suspense fallback={<h1 className="display" style={{ fontSize: 44 }}>Bills and deadlines</h1>}>
      <Bills />
    </Suspense>
  );
}

async function Bills() {
  const { dashboard: d, today, gmail } = await loadApp();
  if (gmail === "connect") return <ConnectGmailEmpty title="Bills and deadlines" />;
  const refYear = Number(today.slice(0, 4));
  // Overdue bills stay listed (lib/resolve.ts keeps 14 days of grace); trials, renewals and price rises only while still ahead.
  const rows: BillRow[] = deadlineRows(d, today).map((r) => ({ ...r, amountLabel: r.amount !== null ? money(r.amount, r.currency) : "Amount unknown" }));
  const paid: PaidRow[] = d.bills
    .filter((b) => b.paid)
    .map((b) => ({ key: b.key, merchant: b.merchant, amountLabel: money(b.amount, b.currency), dueLabel: shortDate(b.dueDate, refYear) }));
  return <BillsView rows={rows} paid={paid} />;
}
