import { NextResponse } from "next/server";
import { DeleteBody } from "@/lib/auth-copy";
import { disconnect } from "@/lib/gmail";
import { logError } from "@/lib/log";
import { requireUser } from "@/lib/route-auth";
import { isDemo } from "@/lib/session";
import { storeFor } from "@/lib/store";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

const UNAVAILABLE = "Account deletion is not available right now. Please try again later.";

function unavailable(e: unknown) {
  logError("account delete failed", e);
  return NextResponse.json({ error: UNAVAILABLE }, { status: 500 });
}

export async function POST(req: Request) {
  if (isDemo()) return NextResponse.json({ error: "Demo mode has no account to delete." }, { status: 400 });
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const { user } = auth;

  const body = DeleteBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Type delete to confirm." }, { status: 400 });

  // Build the admin client first: if it is not configured, nothing is revoked or deleted.
  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e) {
    return unavailable(e);
  }

  // A Google revoke failure must not block deleting the account; the user is told instead.
  let revokeFailed: boolean;
  try {
    ({ revokeFailed } = await disconnect(await storeFor(user)));
  } catch {
    // The connection row is removed with the account either way; the grant may still exist.
    revokeFailed = true;
  }

  try {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return unavailable(error);
  } catch (e) {
    return unavailable(e);
  }

  // The user is gone; clear the session cookies. A failure here is harmless.
  try {
    await (await supabaseServer()).auth.signOut();
  } catch {}
  return NextResponse.json({ ok: true, revokeFailed });
}
