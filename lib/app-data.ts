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
  const { dashboard, connected, reconnect } = await getDashboard(store);
  // PHYLAX_TODAY pins "today" for local testing against old email.
  const today = process.env.PHYLAX_TODAY ?? todayIso();
  // Records found before a Disconnect stay; only an account with nothing found gets the empty state.
  const hasData = dashboard.subscriptions.length > 0 || dashboard.bills.length > 0 || dashboard.receipts.length > 0;
  const gmail = gmailState({ connected, reconnect, hasData });
  return { user, store, dashboard, connected, reconnect, gmail, today };
});

export async function loadSyncNote(store: Store, connected: boolean): Promise<string> {
  if (!connected) return "Gmail not connected";
  const at = await lastSyncedAt(store);
  return at ? `Gmail synced ${ago(at)}` : "Gmail not synced yet";
}
