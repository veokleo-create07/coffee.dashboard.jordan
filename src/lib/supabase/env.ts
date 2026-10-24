import "server-only";

export function getSupabaseEnvironment() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY in the server environment to connect Supabase.");
  }

  return { url, anonKey };
}
