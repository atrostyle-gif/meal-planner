/**
 * 同期エラーのうち、ユーザーに見せないもの（任意テーブル未整備など）。
 */

export function isOptionalSyncInfrastructureError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    message.includes("未整備") ||
    lower.includes("does not exist") ||
    lower.includes("could not find the table") ||
    lower.includes("schema cache") ||
    /relation .+ does not exist/i.test(message) ||
    lower.includes("permission denied for table")
  );
}

/** 設定画面などに出す同期エラーだけ残す */
export function filterUserFacingSyncErrors(errors: readonly string[]): string[] {
  return errors.filter((error) => !isOptionalSyncInfrastructureError(error));
}
