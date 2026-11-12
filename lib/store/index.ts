import type { AppUser } from "../current-user";
import { supabaseServer } from "../supabase/server";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

export type { Store } from "./types";

/** The signed-in user's data, in Supabase. */
export async function storeFor(user: AppUser): Promise<Store> {
  return supabaseStore(await supabaseServer(), user.id);
}
