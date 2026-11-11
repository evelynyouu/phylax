import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/current-user";
import { logError } from "@/lib/log";
import { requireUser } from "@/lib/route-auth";
import { storeFor } from "@/lib/store";
import { getDashboard, GmailReconnectError, runSync, SYNC_FAILED_MESSAGE, SyncAlreadyRunningError, syncProgress } from "@/lib/sync";

export const maxDuration = 300;

/** Syncs the signed-in user's Gmail. One sync per user at a time (lib/sync.ts). */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  try {
    const result = await runSync(await storeFor(auth.user));
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof SyncAlreadyRunningError) return NextResponse.json({ error: e.message }, { status: 409 });
    // Google refused the token. Nothing was deleted; the dashboard asks the user to reconnect.
    if (e instanceof GmailReconnectError) return NextResponse.json({ error: "reconnect" }, { status: 409 });
    // Log the message and a code only (never the error object: Google client errors carry the
    // request config with the Authorization header). The browser gets a fixed line.
    logError("sync failed", e);
    return NextResponse.json({ error: SYNC_FAILED_MESSAGE }, { status: 500 });
  }
}

/**
 * Progress of the user's running sync, plus what has been found so far. Used by sign-up step 3.
 * A same-origin GET carries no Origin header, so this checks the session only; it changes nothing.
 */
export async function GET() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const p = syncProgress(user.id);
  const { dashboard } = await getDashboard(await storeFor(user));
  return NextResponse.json({
    ...p,
    found: {
      subscriptions: dashboard.subscriptions.filter((s) => s.status !== "cancelled").length,
      bills: dashboard.bills.length,
    },
  });
}
