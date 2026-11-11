import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/current-user";
import { requireUser } from "@/lib/route-auth";
import { getDashboard, runSync, syncProgress } from "@/lib/sync";

export const maxDuration = 300;

let running = false;

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  if (running) return NextResponse.json({ error: "A sync is already running" }, { status: 409 });
  running = true;
  try {
    const result = await runSync();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "sync failed" }, { status: 500 });
  } finally {
    running = false;
  }
}

/**
 * Progress of the running sync, plus what has been found so far. Used by sign-up step 3.
 * A same-origin GET carries no Origin header, so this checks the session only; it changes nothing.
 */
export async function GET() {
  if (!(await getOptionalUser())) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const p = syncProgress();
  const { dashboard } = await getDashboard();
  return NextResponse.json({
    ...p,
    found: {
      subscriptions: dashboard.subscriptions.filter((s) => s.status !== "cancelled").length,
      bills: dashboard.bills.length,
    },
  });
}
