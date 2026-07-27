/**
 * 料理フィードバック・我が家版レシピ学習
 * 「使うほど家庭専用のノウハウが蓄積される」ための型。
 */

/** 味の濃さ */
export type TasteSaltLevel = "thin" | "just" | "thick";

/** 甘さ */
export type TasteSweetLevel = "sweet" | "just" | "not_sweet";

/** 辛さ */
export type TasteSpicyLevel = "spicy" | "just" | "not_spicy";

/** 食感 */
export type TextureLevel = "soft" | "just" | "hard";

/** 調理時間の感じ方 */
export type TimeFeelingLevel = "long" | "just" | "short";

export type FamilyMemberRating = {
  memberId: string;
  memberName?: string;
  /** 1〜5 */
  rating: number;
  memo?: string | null;
};

/** ワンタップ改善タグ（カテゴリ付き） */
export type ImprovementTagCategory =
  | "味"
  | "甘さ"
  | "塩分"
  | "辛さ"
  | "食材"
  | "調理"
  | "子ども向け"
  | "その他";

export type ImprovementTag = {
  id: string;
  category: ImprovementTagCategory;
  label: string;
};

export const IMPROVEMENT_TAGS: readonly ImprovementTag[] = [
  { id: "taste_thick", category: "味", label: "味が濃かった" },
  { id: "taste_thin", category: "味", label: "味が薄かった" },
  { id: "taste_bit_thick", category: "味", label: "少し濃い" },
  { id: "taste_very_thick", category: "味", label: "かなり濃い" },
  { id: "taste_bit_thin", category: "味", label: "少し薄い" },
  { id: "taste_very_thin", category: "味", label: "かなり薄い" },
  { id: "taste_just", category: "味", label: "味ちょうどいい" },
  { id: "taste_bland", category: "味", label: "味がぼやける" },
  { id: "sweet_yes", category: "甘さ", label: "甘かった" },
  { id: "sweet_mild", category: "甘さ", label: "甘さ控えめ" },
  { id: "sweet_half_sugar", category: "甘さ", label: "砂糖半分" },
  { id: "sweet_more", category: "甘さ", label: "もう少し甘く" },
  { id: "spicy_yes", category: "辛さ", label: "辛かった" },
  { id: "spicy_more", category: "辛さ", label: "もっと辛く" },
  { id: "spicy_less", category: "辛さ", label: "辛さ控えめ" },
  { id: "spicy_none", category: "辛さ", label: "辛味なし希望" },
  { id: "salt_reduce", category: "塩分", label: "塩分を減らしたい" },
  { id: "salt_less_soy", category: "塩分", label: "しょうゆ控えめ" },
  { id: "salt_more", category: "塩分", label: "もう少し塩を" },
  { id: "ing_onion_more", category: "食材", label: "玉ねぎ多め" },
  { id: "ing_onion_add", category: "食材", label: "玉ねぎ追加" },
  { id: "ing_onion_double", category: "食材", label: "玉ねぎ2倍" },
  { id: "ing_veg_more", category: "食材", label: "野菜を増やした" },
  { id: "ing_pork_koma", category: "食材", label: "豚こまで十分" },
  { id: "ing_pork_bara", category: "食材", label: "豚バラが良い" },
  { id: "ing_chicken", category: "食材", label: "鶏肉でも良い" },
  { id: "ing_mushroom_add", category: "食材", label: "きのこ追加" },
  { id: "ing_garlic_less", category: "食材", label: "にんにく控えめ" },
  { id: "ing_potato_add", category: "食材", label: "じゃがいも追加" },
  { id: "ing_sesame_oil", category: "食材", label: "ごま油追加" },
  { id: "cook_hard", category: "調理", label: "作るのが大変" },
  { id: "cook_faster", category: "調理", label: "時短になった" },
  { id: "cook_simmer_more", category: "調理", label: "煮込み時間追加" },
  { id: "cook_grill_more", category: "調理", label: "焼き時間追加" },
  { id: "cook_heat_low", category: "調理", label: "火力弱め" },
  { id: "cook_pre_marinate", category: "調理", label: "下味を長めに" },
  { id: "cook_one_pot", category: "調理", label: "ワンパン向き" },
  { id: "kid_popular", category: "子ども向け", label: "子どもに好評" },
  { id: "adult_oriented", category: "その他", label: "大人向け" },
  { id: "kid_spicy", category: "子ども向け", label: "子どもには辛い" },
  { id: "kid_cut_small", category: "子ども向け", label: "子ども用に小さく切る" },
  { id: "kid_mild", category: "子ども向け", label: "子ども向け薄味" },
  { id: "other_lunchbox", category: "その他", label: "お弁当に向く" },
  { id: "other_cost", category: "その他", label: "コスパ良い" },
  { id: "other_easy", category: "その他", label: "簡単" },
  { id: "other_hard", category: "その他", label: "手間が多い" },
  { id: "other_makeahead", category: "その他", label: "作り置き向き" },
  { id: "other_freezer", category: "その他", label: "冷凍向き" },
  { id: "want_again", category: "その他", label: "また作る" },
  { id: "repeat_decide", category: "その他", label: "リピート決定" },
] as const;

/** 食後30秒UIですぐ選べる改善タグ */
export const QUICK_IMPROVEMENT_TAG_IDS = [
  "ing_onion_more",
  "sweet_half_sugar",
  "ing_veg_more",
  "taste_thick",
  "taste_thin",
  "kid_popular",
  "cook_faster",
  "want_again",
] as const;

export type RecipeAdjustmentType =
  | "add"
  | "remove"
  | "increase"
  | "decrease"
  | "replace";

/** 食材の変更履歴 */
export type RecipeAdjustment = {
  ingredientName: string;
  adjustmentType: RecipeAdjustmentType;
  beforeValue: string | null;
  afterValue: string | null;
  memo: string | null;
};

/** 調味料の変更履歴 */
export type SeasoningAdjustment = {
  seasoning: string;
  beforeAmount: string | null;
  afterAmount: string | null;
  reason: string | null;
};

export function getImprovementTagById(id: string): ImprovementTag | undefined {
  return IMPROVEMENT_TAGS.find((tag) => tag.id === id);
}

/** 調理セッションへの詳細フィードバック（CookingHistory に紐づく） */
export type CookingFeedback = {
  id: string;
  historyId: string;
  recipeId: string;
  householdId: string;
  /** 実際に作った日時 */
  cookedAt: string;
  createdBy: string | null;
  /** 総合 ★ 1〜5（主評価者） */
  overallRating: number | null;
  tasteSalt: TasteSaltLevel | null;
  tasteSweet: TasteSweetLevel | null;
  tasteSpicy: TasteSpicyLevel | null;
  texture: TextureLevel | null;
  timeFeeling: TimeFeelingLevel | null;
  /** また作る（wouldCookAgain と同義） */
  wantAgain: boolean | null;
  cookingTimeActualMinutes: number | null;
  servingsActual: number | null;
  improvementTags: string[];
  /** 家族ごとの評価（familyRatings） */
  memberRatings: FamilyMemberRating[];
  adjustments: RecipeAdjustment[];
  seasoningAdjustments: SeasoningAdjustment[];
  /** 完成写真（任意・data URL）。無くても使える */
  photoDataUrl: string | null;
  /** notes と同義 */
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * 仕様名 RecipeFeedback。
 * 保存実体は CookingFeedback（互換のため両方の名前を公開）。
 */
export type RecipeFeedback = CookingFeedback;

/** 我が家版レシピ（親レシピは変更しない） */
export type RecipeVariant = {
  id: string;
  parentRecipeId: string;
  /** 複製されたレシピ ID */
  variantRecipeId: string;
  title: string;
  summary: string;
  /** 変更点の箇条書き */
  changes: string[];
  sourceHistoryIds: string[];
  sourceFeedbackIds: string[];
  householdId: string;
  createdAt: string;
  updatedAt: string;
};

/** レシピに集約される学習統計 */
export type RecipeLearningStats = {
  averageRating: number | null;
  cookCount: number;
  lastCookedAt: string | null;
  familyFavoriteScore: number | null;
  improvementCount: number;
  favoriteByUsers: string[];
  /** 人気メンバー表示名候補（ID） */
  popularMemberIds: string[];
  wantAgainYes: number;
  wantAgainNo: number;
  /** 0〜1。データ不足時は null */
  wantAgainRate: number | null;
  popularTagIds: string[];
  recentImprovementLabels: string[];
};

export type QuickFeedbackInput = {
  recipeId: string;
  householdId: string;
  createdBy: string | null;
  cookedAt?: string;
  servings: number;
  cookingTimeActual: number | null;
  overallRating: number | null;
  /** wouldCookAgain と同義 */
  wantAgain: boolean | null;
  improvementTags: string[];
  memo: string;
  memberRatings?: FamilyMemberRating[];
  adjustments?: RecipeAdjustment[];
  seasoningAdjustments?: SeasoningAdjustment[];
  photoDataUrl?: string | null;
  tasteSalt?: TasteSaltLevel | null;
  tasteSweet?: TasteSweetLevel | null;
  tasteSpicy?: TasteSpicyLevel | null;
  texture?: TextureLevel | null;
  timeFeeling?: TimeFeelingLevel | null;
};

export function isRecipeAdjustmentType(
  value: unknown,
): value is RecipeAdjustmentType {
  return (
    value === "add" ||
    value === "remove" ||
    value === "increase" ||
    value === "decrease" ||
    value === "replace"
  );
}
