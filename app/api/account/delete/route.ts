import { NextResponse } from "next/server";
import { avatarObjectPath, AVATAR_BUCKET } from "@/lib/avatar";
import { DeleteBody } from "@/lib/auth-copy";
import { revokeBestEffort } from "@/lib/gmail";
import { logError } from "@/lib/log";
import { requireUser } from "@/lib/route-auth";
import { storeFor } from "@/lib/store";
import type { GmailConnection } from "@/lib/store/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

const UNAVAILABLE = "Account deletion is not available right now. Please try again later.";

function unavailable(e: unknown) {
  logError("account delete failed", e);
  return NextResponse.json({ error: UNAVAILABLE }, { status: 500 });
}

export async function POST(req: Request) {
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

  // Remove the profile photo first: storage objects are not cascaded, and Supabase refuses to delete
  // a user who still owns storage objects. Best effort: a failure is logged and never blocks.
  try {
    const { error } = await admin.storage.from(AVATAR_BUCKET).remove([avatarObjectPath(user.id)]);
    if (error) logError("avatar cleanup failed", error);
  } catch (e) {
    logError("avatar cleanup failed", e);
  }

  // Read the Gmail connection (tokens) without removing it, so a failed delete changes nothing.
  let connection: GmailConnection | null = null;
  let readFailed = false;
  try {
    connection = await (await storeFor(user)).getGmail();
  } catch {
    readFailed = true;
  }

  try {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return unavailable(error);
  } catch (e) {
    return unavailable(e);
  }

  // The user and their rows (including the connection) are gone; revoke Google's grant from the
  // tokens read above. A revoke failure must not block anything; the user is told instead.
  let revokeFailed = readFailed;
  try {
    if (!(await revokeBestEffort(connection))) revokeFailed = true;
  } catch {
    revokeFailed = true;
  }

  // The user is gone; clear the session cookies. A failure here is harmless.
  try {
    await (await supabaseServer()).auth.signOut();
  } catch {}
  return NextResponse.json({ ok: true, revokeFailed });
}
