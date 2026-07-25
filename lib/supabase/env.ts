/**
 * Supabase 環境変数の判定。
 * 未設定時は localStorage モードで動作する。
 *
 * 注意: Next.js は process.env.NEXT_PUBLIC_* の「静的参照」のみ
 * クライアントバンドルへ埋め込む。process.env[name] は使わないこと。
 */

export type AppDataMode = "local" | "supabase";

export function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return typeof value === "string" ? value.trim() : "";
}

export function getSupabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return typeof value === "string" ? value.trim() : "";
}

/** URL が空でないか（値そのものは返さない） */
export function hasSupabaseUrl(): boolean {
  return getSupabaseUrl() !== "";
}

/** anon / publishable key が空でないか（値そのものは返さない） */
export function hasSupabaseAnonKey(): boolean {
  return getSupabaseAnonKey() !== "";
}

/**
 * URL とキーの両方が空でなければ設定済み。
 * sb_publishable_ 形式・従来の eyJ JWT 形式のどちらも可。
 */
export function isSupabaseConfigured(): boolean {
  return hasSupabaseUrl() && hasSupabaseAnonKey();
}

export function getAppDataMode(): AppDataMode {
  return isSupabaseConfigured() ? "supabase" : "local";
}

export function getDataModeLabel(mode: AppDataMode): string {
  return mode === "supabase" ? "家族と共有中" : "この端末だけに保存中";
}
