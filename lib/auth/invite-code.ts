/** 招待コードの簡易バリデーション（推測困難な英数字） */

const CODE_PATTERN = /^[A-Z0-9]{6,12}$/;

export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidInviteCode(value: string): boolean {
  return CODE_PATTERN.test(normalizeInviteCode(value));
}
