import { NextResponse } from "next/server";
import { z } from "zod";
import { setReminder } from "@/lib/db";
import { requireUser } from "@/lib/route-auth";

const Body = z.object({ key: z.string().regex(/^[a-z0-9]{1,100}\|\d{4}-\d{2}-\d{2}$/), on: z.boolean() });

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  setReminder(parsed.data.key, parsed.data.on);
  return NextResponse.json({ ok: true });
}
