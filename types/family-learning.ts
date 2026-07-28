/**
 * 家庭ごとの献立学習プロファイル（この家庭専用の傾向）。
 */

export type FavoriteCuisineStat = {
  name: string;
  avgRating: number;
  count: number;
};

export type FavoriteWeekdayStat = {
  /** monday … sunday */
  day: string;
  label: string;
  avgRating: number;
  count: number;
  preferredMaxMinutes: number | null;
};

export type FavoriteIngredientStat = {
  name: string;
  score: number;
  count: number;
};

export type SuccessfulPattern = {
  id: string;
  label: string;
  weight: number;
  cuisine?: string;
  maxCookingMinutes?: number;
  weekday?: string;
  cookMemberId?: string;
  tagIds?: string[];
};

/** 担当者ごとの学習傾向 */
export type MemberCookLearning = {
  memberId: string;
  memberName: string;
  averageRating: number | null;
  cookCount: number;
  preferredMaxCookingMinutes: number | null;
  /** true: 簡単・短時間を優先 */
  preferEasy: boolean;
  /** true: やや手間でも高評価 */
  acceptElaborate: boolean;
  successfulRecipeIds: string[];
  insight: string | null;
};

export type AvoidedPattern = {
  label: string;
  reason: string;
  weight: number;
  tagIds?: string[];
  cuisine?: string;
};

export type FamilyLearningProfile = {
  householdId: string;
  updatedAt: string;
  /** 学習に使ったサンプル数（フィードバック＋履歴） */
  sampleCount: number;
  favoriteCuisine: FavoriteCuisineStat[];
  favoriteCookingTime: {
    maxMinutes: number;
    avgRating: number;
    count: number;
  } | null;
  favoriteDifficulty: "easy" | "normal" | "elaborate" | null;
  favoriteIngredients: FavoriteIngredientStat[];
  favoriteSeason: string | null;
  favoriteWeekday: FavoriteWeekdayStat[];
  favoriteMealStyle: string[];
  successfulPatterns: SuccessfulPattern[];
  memberLearning: MemberCookLearning[];
  avoidedPatterns: AvoidedPattern[];
  /** AI分析レポート用の短い発見 */
  insights: string[];
  cookCompletionRate: number | null;
  /** 変更で外されがちなレシピ */
  changeAwayRecipeIds: string[];
  /** 味が濃い指摘が多い */
  tasteThickRate: number | null;
  tasteThinRate: number | null;
};

export type MealChangeEvent = {
  id: string;
  householdId: string;
  date: string;
  course: string;
  fromRecipeId: string | null;
  toRecipeId: string;
  at: string;
  source: "manual" | "recommend" | "regenerate";
};

export const EMPTY_FAMILY_LEARNING_PROFILE = (
  householdId = "local",
): FamilyLearningProfile => ({
  householdId,
  updatedAt: new Date().toISOString(),
  sampleCount: 0,
  favoriteCuisine: [],
  favoriteCookingTime: null,
  favoriteDifficulty: null,
  favoriteIngredients: [],
  favoriteSeason: null,
  favoriteWeekday: [],
  favoriteMealStyle: [],
  successfulPatterns: [],
  memberLearning: [],
  avoidedPatterns: [],
  insights: [],
  cookCompletionRate: null,
  changeAwayRecipeIds: [],
  tasteThickRate: null,
  tasteThinRate: null,
});
