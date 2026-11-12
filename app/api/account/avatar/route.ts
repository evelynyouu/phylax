import { NextResponse } from "next/server";
import { AVATAR_BUCKET, AVATAR_MAX_BYTES, avatarObjectPath, sniffImage } from "@/lib/avatar";
import { logError } from "@/lib/log";
import { requireUser } from "@/lib/route-auth";
import { supabaseServer } from "@/lib/supabase/server";

const BAD_FILE = "Use a PNG, JPEG or WebP image under 2 MB.";
const FAILED = "Could not save your photo. Please try again.";

function failed(label: string, e: unknown) {
  logError(label, e);
  return NextResponse.json({ error: FAILED }, { status: 500 });
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const { user } = auth;
  const bad = () => NextResponse.json({ error: BAD_FILE }, { status: 400 });

  // Refuse an obviously huge body before parsing it.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > AVATAR_MAX_BYTES + 64 * 1024) return bad();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string" || file.size > AVATAR_MAX_BYTES) return bad();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImage(bytes);
  if (!contentType) return bad();

  try {
    const supabase = await supabaseServer();
    const path = avatarObjectPath(user.id);
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, bytes, { upsert: true, contentType });
    if (error) return failed("avatar upload failed", error);
    const { error: metaError } = await supabase.auth.updateUser({ data: { avatar_path: path, avatar_updated: new Date().toISOString() } });
    if (metaError) return failed("avatar metadata failed", metaError);
  } catch (e) {
    return failed("avatar upload failed", e);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if ("denied" in auth) return auth.denied;
  const { user } = auth;
  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([avatarObjectPath(user.id)]);
    if (error) return failed("avatar remove failed", error);
    const { error: metaError } = await supabase.auth.updateUser({ data: { avatar_path: null, avatar_updated: new Date().toISOString() } });
    if (metaError) return failed("avatar metadata failed", metaError);
  } catch (e) {
    return failed("avatar remove failed", e);
  }
  return NextResponse.json({ ok: true });
}
