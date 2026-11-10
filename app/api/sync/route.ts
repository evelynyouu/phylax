import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/route-auth";
import { getDashboard, runSync, syncProgress } from "@/lib/sync";
import { userFromRequest } from "@/lib/route-auth";

export const maxDuration = 300;

let running = false;

export async function POST(req: Request) {
  const denied = guardMutation(req);
  if (denied) return denied;
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

/** Progress of the running sync, plus what has been found so far. Used by sign-up step 3. */
export async function GET(req: Request) {
  if (!userFromRequest(req)) return NextResponse.json({ error: "signed out" }, { status: 401 });
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
