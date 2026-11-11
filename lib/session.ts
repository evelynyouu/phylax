// Demo mode: sample data and a fixed user, no Supabase and no Gmail. Never on in production.

export const DEMO_USER = { email: "demo@subwatch.local", name: "Demo account" } as const;

export function isDemo(): boolean {
  return process.env.DATA_SOURCE === "fixtures" && process.env.NODE_ENV !== "production";
}
