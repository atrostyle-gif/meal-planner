/**
 * 余っている食材（献立作成用の簡易メモ）
 * 厳密な在庫管理ではなく「今使いたい食材」を表す。
 */

export const LEFTOVER_PRIORITIES = ["normal", "soon", "must_use"] as const;
export type LeftoverPriority = (typeof LEFTOVER_PRIORITIES)[number];

export const LEFTOVER_PRIORITY_LABELS: Record<LeftoverPriority, string> = {
  normal: "できれば使いたい",
  soon: "早めに使いたい",
  must_use: "優先して使いたい",
};

export const LEFTOVER_SOURCES = [
  "manual",
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
  name: string;
  foodMasterId: string | null;
  quantity: number | null;
  unit: string | null;
  priority: LeftoverPriority;
  notes: string | null;
  source: LeftoverSource;
  status: LeftoverStatus;
  /** 提案採用時に使う予定の日付 */
  plannedForDates: string[];
  /** 移行元の InventoryItem.id（冪等移行用） */
  migratedFromInventoryId: string | null;
  /** 献立提案に反映するか */
  includeInProposal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LeftoverIngredientInput = {
  name: string;
  quantity: number | null;
  unit: string | null;
  priority: LeftoverPriority;
  notes: string | null;
  foodMasterId?: string | null;
  includeInProposal?: boolean;
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

/** 提案対象として扱う余り食材 */
export function isActiveProposalLeftover(item: LeftoverIngredient): boolean {
  return (
    item.includeInProposal &&
    (item.status === "active" || item.status === "planned") &&
    item.name.trim() !== ""
  );
}
