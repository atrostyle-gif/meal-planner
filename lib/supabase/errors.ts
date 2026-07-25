/** Supabase / Auth エラーを利用者向け日本語へ変換する */

export function toUserFacingError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : "不明なエラーが発生しました";

  const lower = message.toLowerCase();

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid_credentials")
  ) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (lower.includes("email not confirmed")) {
    return "メールアドレスの確認が完了していません。";
  }
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "このメールアドレスはすでに登録されています。";
  }
  if (lower.includes("password should be at least")) {
    return "パスワードは6文字以上にしてください。";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "通信に失敗しました。接続を確認して再試行してください。";
  }
  if (lower.includes("jwt") || lower.includes("session") || lower.includes("refresh token")) {
    return "ログインの有効期限が切れました。再度ログインしてください。";
  }
  if (message.includes("すでに家庭へ所属")) {
    return message;
  }
  if (message.includes("招待コード")) {
    return message;
  }
  if (message.includes("オーナーのみ")) {
    return message;
  }
  if (message.includes("ログインが必要")) {
    return "ログインが必要です。";
  }

  // 開発時は詳細を残す
  if (process.env.NODE_ENV === "development") {
    console.warn("[supabase-error]", error);
  }

  return "処理に失敗しました。しばらくしてから再度お試しください。";
}
