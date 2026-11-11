import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/csrf";
import { isDemo } from "@/lib/session";
import { supabaseEnv } from "@/lib/supabase/config";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // supabaseServer clears the session cookies through cookies(), which this response carries.
  if (!isDemo() && supabaseEnv()) await (await supabaseServer()).auth.signOut();
  // 303 so the browser follows the form POST with a GET.
  return NextResponse.redirect(new URL("/signin?auth=signed_out", process.env.APP_URL ?? req.url), 303);
}
