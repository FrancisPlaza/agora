import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Browser client. Cast for the same `@supabase/ssr` ↔ `@supabase/supabase-js`
 * generic mismatch documented in `lib/supabase/server.ts`.
 */
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  ) as unknown as SupabaseClient<Database>;
}
