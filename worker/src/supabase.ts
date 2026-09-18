import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadConfig } from "./config.js";

let client: SupabaseClient | null = null;

/** Service-role client. Runs only inside the worker; never shipped to a browser. */
export function db(): SupabaseClient {
  if (client) return client;
  const config = loadConfig();
  client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
