/**
 * 余っている食材（献立作成直前の簡易メモ）
 * 本格在庫・賞味期限管理ではない。「今週使い切りたい食材」。
 */

/** @deprecated 優先度は廃止。保存互換のため残す（評価では無視） */
export const LEFTOVER_PRIORITIES = ["normal", "soon", "must_use"] as const;
/** @deprecated */
export type LeftoverPriority = (typeof LEFTOVER_PRIORITIES)[number];

/** @deprecated */
export const LEFTOVER_PRIORITY_LABELS: Record<LeftoverPriority, string> = {
  normal: "できれば使いたい",
  soon: "早めに使いたい",
  must_use: "優先して使いたい",
};

export const LEFTOVER_SOURCES = [
  "manual",
  "manual_meal_plan",
  "previous_meal",
  "shopping_remainder",
  "migrated_fridge",
] as const;
export type LeftoverSource = (typeof LEFTOVER_SOURCES)[number];

export const LEFTOVER_STATUSES = [
  "active",
  "planned",
  "used",
  "dismissed",
] as const;
export type LeftoverStatus = (typeof LEFTOVER_STATUSES)[number];

export type LeftoverIngredient = {
  id: string;
  householdId: string;
  /** 表示・照合用（正規化後の標準名を優先） */
  name: string;
  /** 入力時の原文 */
  rawName: string;
  /** 正規化キー */
  normalizedName: string;
  /** Food Master foodCode / id */
  foodCode: string | null;
  foodMasterId: string | null;
  /** 数量の自由記述（任意） */
  quantityText: string | null;
  quantity: number | null;
  unit: string | null;
  /**
   * @deprecated 評価では使わない。同期互換のため soon 固定保存。
   */
  priority: LeftoverPriority;
  notes: string | null;
  source: LeftoverSource;
  status: LeftoverStatus;
  /** 紐付く週間献立の週開始日（YYYY-MM-DD）。次週へ自動継続しない */
  weekStart: string | null;
  plannedForDates: string[];
  migratedFromInventoryId: string | null;
  includeInProposal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LeftoverIngredientInput = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  quantityText?: string | null;
  notes?: string | null;
  foodMasterId?: string | null;
  foodCode?: string | null;
  includeInProposal?: boolean;
  weekStart?: string | null;
  rawName?: string;
};

export type LeftoverUsageLine = {
  id: string;
  name: string;
  recipeCount: number;
  recipeNames: string[];
};

export type LeftoverUsageSummary = {
  used: LeftoverUsageLine[];
  unused: Array<{ id: string; name: string }>;
};

export function isLeftoverPriority(value: unknown): value is LeftoverPriority {
  return (
    typeof value === "string" &&
    (LEFTOVER_PRIORITIES as readonly string[]).includes(value)
  );
}

export function isLeftoverStatus(value: unknown): value is LeftoverStatus {
  return (
    typeof value === "string" &&
    (LEFTOVER_STATUSES as readonly string[]).includes(value)
  );
}

export function isLeftoverSource(value: unknown): value is LeftoverSource {
  return (
    typeof value === "string" &&
    (LEFTOVER_SOURCES as readonly string[]).includes(value)
  );
}

/** 提案対象として扱う余り食材（指定週） */
export function isActiveProposalLeftover(
  item: LeftoverIngredient,
  weekStart?: string | null,
): boolean {
  if (
    !item.includeInProposal ||
    (item.status !== "active" && item.status !== "planned") ||
    item.name.trim() === ""
  ) {
    return false;
  }
  if (weekStart == null || weekStart === "") {
    return true;
  }
  // 週未設定のレガシー行は提案に使わない（翌週持ち越し防止）
  return item.weekStart === weekStart;
}
