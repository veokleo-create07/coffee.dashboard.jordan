"use client";

import { createBrowserClient } from "@supabase/ssr";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let client: BrowserClient | null = null;

/**
 * Creates the browser Supabase client when the public runtime configuration is
 * present. The dashboard still works with its polling fallback when these
 * values are omitted (for example, during local development).
 */
export function createClient(): BrowserClient | null {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  client = createBrowserClient(url, anonKey);
  return client;
}
