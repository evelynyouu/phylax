import { NextResponse } from "next/server";
import { requestOrigin, sameOrigin } from "@/lib/csrf";
import { supabaseEnv } from "@/lib/supabase/config";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // supabaseServer clears the session cookies through cookies(), which this response carries.
  if (supabaseEnv()) await (await supabaseServer()).auth.signOut();
  // 303 so the browser follows the form POST with a GET. The browser's own host: that is where
  // the cleared cookies live (sameOrigin above already checked Origin against Host).
  return NextResponse.redirect(new URL("/signin?auth=signed_out", requestOrigin(req.headers, req.url)), 303);
}
