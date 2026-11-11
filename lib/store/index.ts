import type { AppUser } from "../current-user";
import { isDemo } from "../session";
import { supabaseServer } from "../supabase/server";
import { demoStore } from "./memory";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

export type { Store } from "./types";

/** The signed-in user's data. Demo mode uses the in-memory sample store and never touches Supabase. */
export async function storeFor(user: AppUser): Promise<Store> {
  if (isDemo()) return demoStore();
  return supabaseStore(await supabaseServer(), user.id);
}
