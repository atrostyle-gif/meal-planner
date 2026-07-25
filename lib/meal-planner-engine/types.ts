import type { InventoryItem } from "@/types/inventory";
import type { DayMeal, DayMealRecommendation, MealDishItem } from "@/types/meal-plan";
import type { HouseholdPreferences } from "@/types/meal-preferences";
import type { Recipe } from "@/types/recipe";
import type { RecipeCourse } from "@/types/course";

/** 1レシピのスコアリング結果（将来 AI へ渡せる形） */
export type ScoredRecipeCandidate = {
  recipe: Recipe;
  course: RecipeCourse;
  score: number;
  reasons: string[];
  breakdown: Record<string, number>;
};

/** 1日分のエンジン出力 */
export type PlannedDayMeal = {
  date: string;
  items: MealDishItem[];
  recommendation: DayMealRecommendation;
  /** 候補一覧（AI 改善用） */
  candidatesByCourse: Record<string, ScoredRecipeCandidate[]>;
};

export type MealPlannerEngineInput = {
  weekStart: string;
  days: DayMeal[];
  recipes: Recipe[];
  inventory: InventoryItem[];
  preferences: HouseholdPreferences;
  /** 最近作ったレシピ ID（日付昇順で新しいほど後ろでも可） */
  recentRecipeIds: string[];
};

export type MealPlannerEngineResult = {
  days: DayMeal[];
  filledCount: number;
  priorityUsedCount: number;
  planned: PlannedDayMeal[];
  /**
   * 将来 OpenAI 等へ渡す改善用コンテキスト。
   * ルールベース結果を入力に「さらに改善案」を生成できる。
   */
  aiContext: MealPlannerAiContext;
};

/** AI 連携用の中間表現（現状はルール結果のスナップショット） */
export type MealPlannerAiContext = {
  version: "v2-rules";
  preferences: HouseholdPreferences;
  selectedDays: PlannedDayMeal[];
  notes: string[];
};

export type MealPlannerEngine = {
  planWeek: (input: MealPlannerEngineInput) => MealPlannerEngineResult;
};
