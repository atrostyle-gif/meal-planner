/**
 * 献立選定の構造化説明（将来LLMへ渡せる形）。
 * 文章生成ではなく、ルールで組み立てた短い理由。
 */

export const MEAL_REASON_TYPES = [
  "inventory",
  "health",
  "schedule",
  "review",
  "balance",
  "tags",
  "profile",
  "nutrition",
  "household",
  "combo",
  "other",
] as const;

export type MealReasonType = (typeof MEAL_REASON_TYPES)[number];

/**
 * 1件の判断理由（LLM向けにも使える最小単位）。
 */
export type MealDecisionExplanation = {
  reasonType: MealReasonType;
  /** 表示優先度（大きいほど先） */
  priority: number;
  /** UI用の短い文言（目安20文字） */
  message: string;
  /** 由来（例: leftover:キャベツ / family:太郎 / tag:weight_loss） */
  source: string;
  /** スコア寄与の目安 */
  weight: number;
  /** 「さらに表示」用の補足 */
  detail?: string;
};

/** 構造化バケット（UI・将来のプロンプト用） */
export type MealDecisionStructured = {
  inventory?: string;
  health?: string;
  schedule?: string;
  review?: string;
  balance?: string;
  tags?: string[];
  profile?: string;
  nutrition?: string;
  household?: string;
};

/**
 * 1品の採用理由一式（判断履歴）。
 */
export type MealSelectionReason = {
  score: number;
  stars: number;
  reasons: MealDecisionExplanation[];
  positiveFactors: string[];
  negativeFactors: string[];
  tagInfluence: string[];
  nutritionInfluence: string[];
  profileInfluence: string[];
  reviewInfluence: string[];
  inventoryInfluence: string[];
  structured: MealDecisionStructured;
};

export function isMealReasonType(value: unknown): value is MealReasonType {
  return (
    typeof value === "string" &&
    (MEAL_REASON_TYPES as readonly string[]).includes(value)
  );
}

export function isMealDecisionExplanation(
  value: unknown,
): value is MealDecisionExplanation {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isMealReasonType(item.reasonType) &&
    typeof item.priority === "number" &&
    typeof item.message === "string" &&
    typeof item.source === "string" &&
    typeof item.weight === "number"
  );
}

export function isMealSelectionReason(
  value: unknown,
): value is MealSelectionReason {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.score === "number" &&
    typeof item.stars === "number" &&
    Array.isArray(item.reasons) &&
    item.reasons.every(isMealDecisionExplanation) &&
    typeof item.structured === "object" &&
    item.structured !== null
  );
}
