import type { RecipeCourse } from "@/types/course";
import type { BudgetMode } from "@/types/food-budget";

/** 献立アイテムの入力元 */
export type MealSource = "manual" | "fixed" | "auto";

/** 自動生成時のおすすめ説明（献立カード表示用） */
export type DayMealRecommendation = {
  /** 合計スコア（エンジン内部） */
  score: number;
  /** おすすめ度 ★ 1〜5 */
  stars: number;
  /** 表示用の理由リスト */
  reasons: string[];
};

/**
 * 1日の献立に含まれる1品。
 * 今後 notes / servingsOverride などを追加しやすい形にする。
 */
export type MealDishItem = {
  id: string;
  /** レシピ参照。直接入力のみの場合は null */
  recipeId: string | null;
  /** 献立側で変更可能な料理区分（初期値はレシピの course） */
  course: RecipeCourse;
  /** 表示順（1始まり） */
  order: number;
  /** 直接入力の料理名（外食など） */
  customName?: string | null;
  source?: MealSource;
  /** 将来拡張用 */
  notes?: string;
  servingsOverride?: number | null;
  /** 自動生成時のスコア（任意） */
  engineScore?: number;
  engineReasons?: string[];
  /** 提案時にマッチした余り食材 ID（採用時 planned 用） */
  matchedLeftoverIds?: string[];
  /**
   * 枠単位のロック。true の場合、再生成してもこの枠は変更しない。
   * 日単位の locked（DayMeal.locked）とは別。
   */
  slotLocked?: boolean;
  /** 選定理由の詳細文（自動編成時） */
  selectionReasons?: string[];
  /** 選定理由バッジ（時短・魚の日など） */
  selectionBadges?: string[];
};

/** 1日分の献立 */
export type DayMeal = {
  date: string;
  /** 固定（自動作成で変更しない） */
  locked: boolean;
  items: MealDishItem[];
  /** 自動生成結果の要約（手動変更後も残してよい） */
  recommendation?: DayMealRecommendation | null;
  /** その日に食べる家族メンバー */
  participantMemberIds?: string[];
};

/** 1週間分の献立（月曜始まり） */
export type MealPlan = {
  id: string;
  weekStart: string;
  /** 月〜日の7日分 */
  days: DayMeal[];
  /** 週ごとの食費予算（未設定なら世帯デフォルト） */
  weeklyFoodBudgetYen?: number | null;
  /** 週ごとの予算表示モード */
  budgetMode?: BudgetMode | null;
  createdAt: string;
  updatedAt: string;
};
