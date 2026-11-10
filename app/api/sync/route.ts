import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/route-auth";
import { runSync } from "@/lib/sync";

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
