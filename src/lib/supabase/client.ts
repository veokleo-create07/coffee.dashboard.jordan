"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnvironment } from "./env";

let client: SupabaseClient | undefined;

export function createClient() {
  if (!client) {
    const { url, anonKey } = getSupabaseEnvironment();
    client = createBrowserClient(url, anonKey);
  }

  return client;
}
