/**
 * 家族招待リンク・共有文面の生成。
 */
import {
  isValidInviteCode,
  normalizeInviteCode,
} from "@/lib/auth/invite-code";

/** 招待参加ページのパス（クエリ付き） */
export function buildInvitePath(code: string): string {
  const normalized = normalizeInviteCode(code);
  return `/join?code=${encodeURIComponent(normalized)}`;
}

/** 絶対URLの招待リンク */
export function buildInviteUrl(code: string, origin?: string): string {
  const path = buildInvitePath(code);
  if (origin && origin.length > 0) {
    return `${origin.replace(/\/$/, "")}${path}`;
  }
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

/** LINE に送る招待メッセージ */
export function buildInviteShareText(options: {
  householdName: string;
  code: string;
  inviteUrl: string;
}): string {
  const name = options.householdName.trim() || "家族";
  const code = normalizeInviteCode(options.code);
  return [
    `【献立アプリ】${name}への招待です`,
    "",
    "下のリンクを開いて参加してください。",
    "（ログイン／新規登録後、招待コードは自動で入ります）",
    "",
    options.inviteUrl,
    "",
    `招待コード: ${code}`,
  ].join("\n");
}

/** LINE のテキスト共有URL */
export function buildLineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

/** URL クエリから招待コードを取り出す */
export function readInviteCodeFromSearch(
  search: string | { get(name: string): string | null },
): string | null {
  const raw =
    typeof search === "string"
      ? new URLSearchParams(
          search.startsWith("?") ? search.slice(1) : search,
        ).get("code")
      : search.get("code");
  if (!raw) {
    return null;
  }
  const code = normalizeInviteCode(raw);
  return isValidInviteCode(code) ? code : null;
}
