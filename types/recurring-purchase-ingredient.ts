import {
  DAYS_OF_WEEK,
  type DayOfWeek,
} from "@/types/weekly-lifestyle";

/** 定期購入の頻度（初期は毎週のみ） */
export const RECURRING_PURCHASE_FREQUENCIES = ["weekly"] as const;

export type RecurringPurchaseFrequency =
  (typeof RECURRING_PURCHASE_FREQUENCIES)[number];

export const RECURRING_PURCHASE_FREQUENCY_LABELS: Record<
  RecurringPurchaseFrequency,
  string
> = {
  weekly: "毎週",
};

export type RecurringPurchaseIngredient = {
  id: string;
  householdId: string;
  /** 表示名（正規化後） */
  name: string;
  /** 入力時の生の名前 */
  rawName: string;
  normalizedName: string;
  foodMasterId: string | null;
  foodCode: string | null;
  quantity: number | null;
  unit: string | null;
  /** 購入先店舗ID（任意） */
  storeId: string | null;
  /** 購入先表示名 */
  storeName: string | null;
  /** 到着曜日（その日以降の献立で在庫相当） */
  arrivalDayOfWeek: DayOfWeek;
  frequency: RecurringPurchaseFrequency;
  active: boolean;
  /** 献立自動編成で優先使用するか */
  preferInMealPlan: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecurringPurchaseIngredientInput = {
  name: string;
  rawName?: string;
  quantity?: number | null;
  unit?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  arrivalDayOfWeek: DayOfWeek;
  frequency?: RecurringPurchaseFrequency;
  active?: boolean;
  preferInMealPlan?: boolean;
  foodMasterId?: string | null;
  foodCode?: string | null;
};

export function isDayOfWeek(value: unknown): value is DayOfWeek {
  return (
    typeof value === "string" &&
    (DAYS_OF_WEEK as readonly string[]).includes(value)
  );
}

export function isRecurringPurchaseFrequency(
  value: unknown,
): value is RecurringPurchaseFrequency {
  return (
    typeof value === "string" &&
    (RECURRING_PURCHASE_FREQUENCIES as readonly string[]).includes(value)
  );
}
