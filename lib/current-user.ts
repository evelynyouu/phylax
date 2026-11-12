import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseEnv } from "./supabase/config";
import { supabaseServer } from "./supabase/server";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatarPath: string | null;
  providers: string[];
}

export function appUserFrom(user: User): AppUser {
  const email = user.email ?? "";
  const meta = user.user_metadata ?? {};
  // display_name is what the user picks in Settings. Google sign-in can rewrite full_name and name.
  const name = [meta.display_name, meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "");
  const app = user.app_metadata ?? {};
  const providers: string[] = Array.isArray(app.providers)
    ? app.providers.filter((p: unknown): p is string => typeof p === "string")
    : typeof app.provider === "string"
      ? [app.provider]
      : [];
  const avatarPath = typeof meta.avatar_path === "string" && meta.avatar_path ? meta.avatar_path : null;
  return { id: user.id, email, name: name ?? email.split("@")[0], avatarPath, providers };
}

/**
 * The signed-in user, or null. Asks Supabase to verify the session (getUser, not getSession).
 * Request-time: call inside a Suspense boundary or a route handler. Cached per request.
 */
export const getOptionalUser = cache(async (): Promise<AppUser | null> => {
  if (!supabaseEnv()) return null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return appUserFrom(data.user);
});

/** For Server Components inside a Suspense boundary. Redirects to sign-in when signed out. */
export async function getCurrentUser(): Promise<AppUser> {
  const user = await getOptionalUser();
  if (!user) redirect("/signin");
  return user;
}
