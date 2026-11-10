import { connection } from "next/server";
import { getCurrentUser } from "./current-user";
import { todayIso } from "./extract/dates";
import { ago } from "./format";
import { getDashboard, lastSyncedAt } from "./sync";

/** Everything an /app page needs at request time. Call inside a Suspense boundary. */
export async function loadApp() {
  await connection();
  const user = await getCurrentUser();
  const { dashboard, source } = await getDashboard();
  // getDashboard pins "today" in demo mode so the sample data stays current.
  const today = process.env.SUBWATCH_TODAY ?? todayIso();
  return { user, dashboard, source, today };
}

export async function loadSyncNote(source: "gmail" | "fixtures"): Promise<string> {
  if (source === "fixtures") return "Sample data, not your Gmail";
  const at = lastSyncedAt();
  return at ? `Gmail synced ${ago(at)}` : "Gmail not synced yet";
}
