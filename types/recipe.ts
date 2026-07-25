import type { RecipeCourse } from "@/types/course";
import type { IngredientType } from "@/types/ingredient-meta";
import type { RecipeCookingProfile } from "@/types/weekly-lifestyle";
import type { NutritionStatus } from "@/types/diabetes-meal-support";
import type {
  RecipeImportMethod,
  RecipeMealAffinity,
  RecipeSource,
} from "@/types/recipe-import";
import type {
  ProteinType,
  RecipeSeason,
} from "@/types/recipe-nutrition";

export type { RecipeCourse } from "@/types/course";
export {
  AUTO_FILL_COURSES,
  COURSE_ICONS,
  DEFAULT_RECIPE_COURSE,
  RECIPE_COURSES,
  formatCourseLabel,
  getCourseIcon,
  isRecipeCourse,
} from "@/types/course";
export type { IngredientType } from "@/types/ingredient-meta";
export {
  DEFAULT_INGREDIENT_TYPE,
  INGREDIENT_TYPES,
  INGREDIENT_TYPE_LABELS,
  isIngredientType,
  isPantryIngredientType,
} from "@/types/ingredient-meta";
export type { ProteinType, RecipeSeason } from "@/types/recipe-nutrition";
export {
  PROTEIN_TYPES,
  RECIPE_SEASONS,
  isProteinType,
  isRecipeSeason,
} from "@/types/recipe-nutrition";

/** 初期単位候補 */
export const INGREDIENT_UNITS = [
  "個",
  "本",
  "枚",
  "袋",
  "パック",
  "缶",
  "g",
  "kg",
  "ml",
  "L",
  "大さじ",
  "小さじ",
  "適量",
  "少々",
] as const;

export type IngredientUnitPreset = (typeof INGREDIENT_UNITS)[number];

/** 数量が不要な単位 */
export const QUANTITY_OPTIONAL_UNITS: readonly string[] = ["適量", "少々"];

/**
 * 構造化材料。
 * 買い物リスト・在庫差し引き・集計に使える形。
 */
export type Ingredient = {
  id: string;
  name: string;
  /** 未入力は null。小数可 */
  quantity: number | null;
  unit: string;
  /** 任意メモ */
  note: string;
  /** 在庫区分（通常／常備調味料など） */
  ingredientType: IngredientType;
};

/** フォーム入力用の材料行 */
export type IngredientInput = {
  name: string;
  quantity: number | null;
  unit: string;
  note: string;
  ingredientType: IngredientType;
};

/** 調理手順の1工程 */
export type RecipeStep = {
  id: string;
  order: number;
  text: string;
};

/** フォーム入力用の手順行 */
export type RecipeStepInput = {
  text: string;
};

/** 初期カテゴリー一覧 */
export const RECIPE_CATEGORIES = [
  "和食",
  "洋食",
  "中華",
  "韓国",
  "イタリアン",
  "カレー",
  "麺類",
  "丼物",
  "鍋",
  "スープ",
  "サラダ",
  "お弁当",
  "デザート",
  "その他",
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

/** 未設定・不明カテゴリーのフォールバック */
export const DEFAULT_RECIPE_CATEGORY: RecipeCategory = "その他";

/** 基準人数の初期値 */
export const DEFAULT_SERVINGS = 4;

/** レシピ */
export type Recipe = {
  id: string;
  name: string;
  ingredients: Ingredient[];
  /** 調理手順（工程ごと） */
  steps: RecipeStep[];
  memo?: string;
  /** カテゴリーは1つ */
  category: RecipeCategory;
  /** 料理区分（主食・主菜など） */
  course: RecipeCourse;
  /** 自由入力タグ（複数可） */
  tags: string[];
  /** 基準人数（1以上の整数） */
  servings: number;
  /** 調理時間（分）。未入力は null */
  cookingTimeMinutes: number | null;
  /** カロリー（kcal / 1人分目安）。未設定は null */
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbohydrates: number | null;
  salt: number | null;
  /** 野菜量（g / 1人分目安） */
  vegetables: number | null;
  /**
   * 拡張栄養情報（糖尿病配慮・詳細集計用）。
   * すべて nullable。根拠のない 0 埋めはしない。
   */
  nutritionStatus?: NutritionStatus | null;
  caloriesKcal?: number | null;
  carbohydratesG?: number | null;
  sugarsG?: number | null;
  dietaryFiberG?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  saturatedFatG?: number | null;
  sodiumMg?: number | null;
  saltEquivalentG?: number | null;
  /** 材料からの自動計算カバー率（0〜100）。未計算は null */
  nutritionCoverage?: number | null;
  /** 栄養値の算出元 */
  calculationSource?:
    | "manual"
    | "automatic"
    | "mixed"
    | "unknown"
    | null;
  proteinType: ProteinType | null;
  season: RecipeSeason | null;
  /** 難易度 1〜5 */
  difficulty: number | null;
  /** 好みスコア 0〜5 */
  favoriteScore: number | null;
  /** ヘルシーさ 0〜5 */
  healthyScore: number | null;
  /** 調理担当者との相性・手間に関する情報 */
  cookingProfile?: RecipeCookingProfile | null;
  /** 取り込み方法・出典 */
  importMethod?: RecipeImportMethod | null;
  source?: RecipeSource | null;
  mealAffinity?: RecipeMealAffinity | null;
  extractionWarnings?: string[];
  /**
   * 検証用サンプルデータかどうか。
   * true のレシピは removeSampleRecipes() で一括削除できる。
   */
  isSample: boolean;
  /** 学習統計（履歴から自動更新） */
  averageRating?: number | null;
  cookCount?: number | null;
  lastCookedAt?: string | null;
  familyFavoriteScore?: number | null;
  improvementCount?: number | null;
  favoriteByUsers?: string[];
  wantAgainYes?: number;
  wantAgainNo?: number;
  /** 我が家版の親レシピ */
  parentRecipeId?: string | null;
  isFamilyVariant?: boolean;
  variantSummary?: string | null;
  /** Supabase 共有時の家庭 ID（localStorage モードでは未使用） */
  householdId?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** フォーム入力用（保存前） */
export type RecipeInput = {
  name: string;
  ingredients: IngredientInput[];
  steps: RecipeStepInput[];
  memo: string;
  category: RecipeCategory;
  course: RecipeCourse;
  tags: string[];
  servings: number;
  cookingTimeMinutes: number | null;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbohydrates: number | null;
  salt: number | null;
  vegetables: number | null;
  nutritionStatus?: NutritionStatus | null;
  caloriesKcal?: number | null;
  carbohydratesG?: number | null;
  sugarsG?: number | null;
  dietaryFiberG?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  saturatedFatG?: number | null;
  sodiumMg?: number | null;
  saltEquivalentG?: number | null;
  nutritionCoverage?: number | null;
  calculationSource?:
    | "manual"
    | "automatic"
    | "mixed"
    | "unknown"
    | null;
  proteinType: ProteinType | null;
  season: RecipeSeason | null;
  difficulty: number | null;
  favoriteScore: number | null;
  healthyScore: number | null;
  /** 調理担当者との相性・手間に関する情報 */
  cookingProfile?: RecipeCookingProfile | null;
  importMethod?: RecipeImportMethod | null;
  source?: RecipeSource | null;
  mealAffinity?: RecipeMealAffinity | null;
  extractionWarnings?: string[];
};

export function isRecipeCategory(value: unknown): value is RecipeCategory {
  return (
    typeof value === "string" &&
    (RECIPE_CATEGORIES as readonly string[]).includes(value)
  );
}
