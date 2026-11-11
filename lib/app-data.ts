import { connection } from "next/server";
import { cache } from "react";
import { getCurrentUser } from "./current-user";
import { todayIso } from "./extract/dates";
import { ago } from "./format";
import { storeFor } from "./store";
import type { Store } from "./store/types";
import { getDashboard, lastSyncedAt } from "./sync";
import { gmailState } from "./views";

/**
 * Everything an /app page needs at request time, for the signed-in user. Call inside a Suspense
 * boundary. Cached per request, so the layout and the page share one read.
 */
export const loadApp = cache(async () => {
  await connection();
  const user = await getCurrentUser();
  const store = await storeFor(user);
  const { dashboard, source, connected, reconnect } = await getDashboard(store);
  // getDashboard pins "today" in demo mode so the sample data stays current.
  const today = process.env.SUBWATCH_TODAY ?? todayIso();
  // Records found before a Disconnect stay; only an account with nothing found gets the empty state.
  const hasData = dashboard.subscriptions.length > 0 || dashboard.bills.length > 0 || dashboard.receipts.length > 0;
  const gmail = gmailState({ connected, reconnect, hasData });
  return { user, store, dashboard, source, connected, reconnect, gmail, today };
});

export async function loadSyncNote(store: Store, source: "gmail" | "fixtures", connected: boolean): Promise<string> {
  if (source === "fixtures") return "Sample data, not your Gmail";
  if (!connected) return "Gmail not connected";
  const at = await lastSyncedAt(store);
  return at ? `Gmail synced ${ago(at)}` : "Gmail not synced yet";
}
