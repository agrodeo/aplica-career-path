import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadConfig } from "./config.js";

let client: SupabaseClient | null = null;

function createSupabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    }

    // Modern sb_secret_* API keys are opaque API keys, not bearer JWTs.
    if (key.startsWith("sb_secret_") && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

/** Secret-key client. Runs only inside the worker; never shipped to a browser. */
export function db(): SupabaseClient {
  if (client) return client;
  const config = loadConfig();
  client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    global: { fetch: createSupabaseFetch(config.SUPABASE_SERVICE_ROLE_KEY) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
