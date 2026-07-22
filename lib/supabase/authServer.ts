import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getRuntimeEnv } from "../runtimeEnv";

function getSupabaseAuthConfig() {
  const supabaseUrl = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase Auth configuration");
  }

  return { supabaseUrl, anonKey };
}

export async function createSupabaseAuthServerClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, anonKey } = getSupabaseAuthConfig();

  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. Middleware refreshes them first.
        }
      }
    }
  });
}
