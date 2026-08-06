/**
 * レシピ取り込み用の中間型（未保存）
 */

export const RECIPE_IMPORT_METHODS = ["manual", "url", "photo", "youtube"] as const;
export type RecipeImportMethod = (typeof RECIPE_IMPORT_METHODS)[number];

export const IMPORT_CONFIDENCES = ["high", "medium", "low", "unknown"] as const;
export type ImportConfidence = (typeof IMPORT_CONFIDENCES)[number];

export const IMPORT_CUISINES = [
  "japanese",
  "western",
  "italian",
  "chinese",
  "korean",
  "ethnic",
  "mixed",
  "other",
  "unknown",
] as const;
export type ImportCuisine = (typeof IMPORT_CUISINES)[number];

export const IMPORT_MEAL_ROLES = [
  "staple",
  "main",
  "side",
  "soup",
  "salad",
  "dessert",
  "one_dish",
] as const;
export type ImportMealRole = (typeof IMPORT_MEAL_ROLES)[number];

export const IMPORT_STAPLE_TYPES = [
  "rice",
  "bread",
  "pasta",
  "noodles",
  "none",
  "unknown",
] as const;
export type ImportStapleType = (typeof IMPORT_STAPLE_TYPES)[number];

export const IMPORT_MEAL_STYLES = [
  "japanese_set",
  "western_set",
  "pasta_set",
  "noodle_set",
  "rice_bowl_set",
  "curry_set",
  "hot_pot",
  "one_plate",
  "standalone",
  "unknown",
] as const;
export type ImportMealStyle = (typeof IMPORT_MEAL_STYLES)[number];

export const IMPORT_FLAVOR_TRAITS = [
  "light",
  "rich",
  "creamy",
  "spicy",
  "sweet_savory",
  "sour",
  "fried",
  "grilled",
  "simmered",
  "raw",
  "soup_based",
] as const;
export type ImportFlavorTrait = (typeof IMPORT_FLAVOR_TRAITS)[number];

export const PHOTO_KINDS = [
  "recipe_book",
  "handwritten",
  "web_screenshot",
  "ingredients_only",
  "steps_only",
  "finished_dish",
  "unknown",
] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export type RecipeDraftIngredient = {
  rawText: string;
  name: string;
  foodMasterId?: string | null;
  quantity?: number | null;
  quantityText?: string | null;
  unit?: string | null;
  note?: string | null;
  /** 材料グループ見出し（グループ自体は材料行にしない） */
  groupName?: string | null;
  /** 「または」等で併記された別名 */
  alias?: string | null;
  confidence?: ImportConfidence;
};

export type RecipeDraftStep = {
  order: number;
  text: string;
  sectionName?: string | null;
  temperatureCelsius?: number | null;
  durationMinutes?: number | null;
  confidence?: ImportConfidence;
};

export type RecipeSource = {
  type: RecipeImportMethod;
  title?: string | null;
  url?: string | null;
  /** チャンネル名など（YouTube） */
  author?: string | null;
  /** サムネイルURL（YouTubeなど。既存データでは未設定可） */
  thumbnail?: string | null;
  importedAt?: string | null;
  note?: string | null;
};

export type RecipeMealAffinity = {
  cuisine: ImportCuisine;
  mealRole: ImportMealRole;
  stapleType: ImportStapleType;
  mealStyle: ImportMealStyle;
  flavorTraits: ImportFlavorTrait[];
  source: "manual" | "estimated" | "imported";
};

export type RecipeDraft = {
  title?: string;
  description?: string;
  servings?: number | null;
  servingsText?: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  ingredients: RecipeDraftIngredient[];
  steps: RecipeDraftStep[];
  cuisine?: ImportCuisine | null;
  category?: string | null;
  mealRole?: ImportMealRole | null;
  stapleType?: ImportStapleType | null;
  mealStyle?: ImportMealStyle | null;
  flavorTraits?: ImportFlavorTrait[];
  tags?: string[];
  imageUrl?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  sourceAuthor?: string | null;
  importMethod: RecipeImportMethod;
  importedAt?: string;
  warnings?: string[];
  photoKind?: PhotoKind | null;
  confidence?: ImportConfidence;
  /** URL取り込み時の採用ソース（ユーザー向け表示は別マッピング） */
  importSource?:
    | "json_ld"
    | "microdata"
    | "html_rules"
    | "ai_html"
    | "hybrid"
    | "youtube_description"
    | "failed"
    | null;
  /** フィールド単位の出典 */
  fieldSources?: Partial<
    Record<
      | "title"
      | "description"
      | "servings"
      | "ingredients"
      | "steps"
      | "imageUrl"
      | "times"
      | "cuisine",
      "json_ld" | "ai_html" | "open_graph" | "html_rules" | "microdata" | "merged"
    >
  >;
  /** AIが判定した文書種別 */
  documentType?:
    | "recipe_page"
    | "partial_recipe"
    | "not_recipe"
    | "unknown"
    | null;
};

export const IMPORT_CUISINE_LABELS: Record<ImportCuisine, string> = {
  japanese: "和食",
  western: "洋食",
  italian: "イタリアン",
  chinese: "中華",
  korean: "韓国",
  ethnic: "エスニック",
  mixed: "ミックス",
  other: "その他",
  unknown: "不明",
};

export const IMPORT_MEAL_ROLE_LABELS: Record<ImportMealRole, string> = {
  staple: "主食",
  main: "主菜",
  side: "副菜",
  soup: "汁物",
  salad: "サラダ",
  dessert: "デザート",
  one_dish: "一品完結",
};

export const IMPORT_STAPLE_LABELS: Record<ImportStapleType, string> = {
  rice: "ご飯",
  bread: "パン",
  pasta: "パスタ",
  noodles: "麺",
  none: "なし",
  unknown: "不明",
};
