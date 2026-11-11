// Supabase URL and anon key, or null when they are not set. Literal process.env reads so the
// NEXT_PUBLIC_ values are inlined into client bundles too.
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}
