import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DEMO_USER, isDemo } from "./session";
import { supabaseEnv } from "./supabase/config";
import { supabaseServer } from "./supabase/server";

export interface AppUser {
  id: string;
  email: string;
  name: string;
}

export const DEMO_APP_USER: AppUser = { id: "demo", email: DEMO_USER.email, name: DEMO_USER.name };

export function appUserFrom(user: User): AppUser {
  const email = user.email ?? "";
  const meta = user.user_metadata ?? {};
  const name = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "");
  return { id: user.id, email, name: name ?? email.split("@")[0] };
}

/**
 * The signed-in user, or null. Asks Supabase to verify the session (getUser, not getSession).
 * Request-time: call inside a Suspense boundary or a route handler. Cached per request.
 */
export const getOptionalUser = cache(async (): Promise<AppUser | null> => {
  if (isDemo()) return DEMO_APP_USER;
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
