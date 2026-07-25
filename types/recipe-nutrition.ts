/**
 * レシピの栄養・特性メタデータ（献立エンジン v2）
 */

export const PROTEIN_TYPES = [
  "牛",
  "豚",
  "鶏",
  "魚",
  "卵",
  "大豆",
  "なし",
] as const;

export type ProteinType = (typeof PROTEIN_TYPES)[number];

export const RECIPE_SEASONS = ["春", "夏", "秋", "冬", "通年"] as const;

export type RecipeSeason = (typeof RECIPE_SEASONS)[number];

export function isProteinType(value: unknown): value is ProteinType {
  return (
    typeof value === "string" &&
    (PROTEIN_TYPES as readonly string[]).includes(value)
  );
}

export function isRecipeSeason(value: unknown): value is RecipeSeason {
  return (
    typeof value === "string" &&
    (RECIPE_SEASONS as readonly string[]).includes(value)
  );
}

export function clampScore0to5(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(5, Math.max(0, Math.round(value)));
}

export function clampDifficulty(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}
