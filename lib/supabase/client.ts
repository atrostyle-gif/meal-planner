import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient<Database> | null = null;

/** ブラウザ用 Supabase クライアント。未設定時は null */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
  );
  return browserClient;
}
