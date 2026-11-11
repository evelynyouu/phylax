import { NextResponse } from "next/server";
import { DeleteBody } from "@/lib/auth-copy";
import { disconnect } from "@/lib/gmail";
import { requireUser } from "@/lib/route-auth";
import { isDemo } from "@/lib/session";
import { storeFor } from "@/lib/store";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (isDemo()) return NextResponse.json({ error: "Demo mode has no account to delete." }, { status: 400 });
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const { user } = auth;

  const body = DeleteBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Type delete to confirm." }, { status: 400 });

  // Best effort: a Google revoke failure must not block deleting the account.
  try {
    await disconnect(await storeFor(user));
  } catch {
    // The connection row is removed with the account either way.
  }

  const { error } = await supabaseAdmin().auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "Could not delete your account. Please try again." }, { status: 500 });

  // The user is gone; clear the session cookies. A failure here is harmless.
  try {
    await (await supabaseServer()).auth.signOut();
  } catch {}
  return NextResponse.json({ ok: true });
}
