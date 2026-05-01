import {
  createServerClient,
  type CookieMethodsServer,
} from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Cookie-bound server client. Used in server components, server actions,
 * route handlers, and middleware-triggered code paths.
 *
 * Cast to `SupabaseClient<Database>`: `@supabase/ssr@0.6.1` passes generics
 * to `SupabaseClient` in the wrong slot for the newer `@supabase/supabase-js`
 * generic order, so the inferred Database degrades to `never` and `.from()`
 * calls go untyped. Casting at the wrapper boundary restores the typing for
 * every caller. Revisit once `@supabase/ssr` catches up.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from a Server Component — ignore.
            // Middleware will handle cookie refresh.
          }
        },
      } satisfies CookieMethodsServer,
    },
  ) as unknown as SupabaseClient<Database>;
}

/** Service-role client for admin operations that bypass RLS. */
export function createServiceClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}
