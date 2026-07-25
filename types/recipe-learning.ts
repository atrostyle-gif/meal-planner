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
  { id: "taste_bit_thick", category: "味", label: "少し濃い" },
  { id: "taste_very_thick", category: "味", label: "かなり濃い" },
  { id: "taste_bit_thin", category: "味", label: "少し薄い" },
  { id: "taste_very_thin", category: "味", label: "かなり薄い" },
  { id: "taste_just", category: "味", label: "味ちょうどいい" },
  { id: "taste_bland", category: "味", label: "味がぼやける" },
  { id: "sweet_yes", category: "甘さ", label: "甘い" },
  { id: "sweet_mild", category: "甘さ", label: "甘さ控えめ" },
  { id: "sweet_half_sugar", category: "甘さ", label: "砂糖半分でOK" },
  { id: "sweet_more", category: "甘さ", label: "もう少し甘く" },
  { id: "salt_reduce", category: "塩分", label: "塩分を減らしたい" },
  { id: "salt_less_soy", category: "塩分", label: "しょうゆ控えめ" },
  { id: "salt_more", category: "塩分", label: "もう少し塩を" },
  { id: "spicy_yes", category: "辛さ", label: "辛い" },
  { id: "spicy_more", category: "辛さ", label: "もっと辛く" },
  { id: "spicy_less", category: "辛さ", label: "辛さ控えめ" },
  { id: "spicy_none", category: "辛さ", label: "辛味なし希望" },
  { id: "ing_pork_koma", category: "食材", label: "豚こまで十分" },
  { id: "ing_pork_bara", category: "食材", label: "豚バラが良い" },
  { id: "ing_chicken", category: "食材", label: "鶏肉でも良い" },
  { id: "ing_onion_add", category: "食材", label: "玉ねぎ追加" },
  { id: "ing_onion_double", category: "食材", label: "玉ねぎ2倍" },
  { id: "ing_mushroom_add", category: "食材", label: "きのこ追加" },
  { id: "ing_veg_more", category: "食材", label: "野菜増量" },
  { id: "ing_garlic_less", category: "食材", label: "にんにく控えめ" },
  { id: "ing_potato_add", category: "食材", label: "じゃがいも追加" },
  { id: "cook_simmer_more", category: "調理", label: "煮込み時間追加" },
  { id: "cook_grill_more", category: "調理", label: "焼き時間追加" },
  { id: "cook_heat_low", category: "調理", label: "火力弱め" },
  { id: "cook_pre_marinate", category: "調理", label: "下味を長めに" },
  { id: "cook_one_pot", category: "調理", label: "ワンパン向き" },
  { id: "kid_spicy", category: "子ども向け", label: "子どもには辛い" },
  { id: "kid_popular", category: "子ども向け", label: "子どもに人気" },
  { id: "kid_cut_small", category: "子ども向け", label: "子ども用に小さく切る" },
  { id: "kid_mild", category: "子ども向け", label: "子ども向け薄味" },
  { id: "other_cost", category: "その他", label: "コスパ良い" },
  { id: "other_easy", category: "その他", label: "簡単" },
  { id: "other_hard", category: "その他", label: "手間が多い" },
  { id: "other_makeahead", category: "その他", label: "作り置き向き" },
  { id: "other_freezer", category: "その他", label: "冷凍向き" },
  { id: "other_lunchbox", category: "その他", label: "お弁当向き" },
  { id: "want_again", category: "その他", label: "また作る" },
] as const;

export function getImprovementTagById(id: string): ImprovementTag | undefined {
  return IMPROVEMENT_TAGS.find((tag) => tag.id === id);
}

/** 調理セッションへの詳細フィードバック（CookingHistory に紐づく） */
export type CookingFeedback = {
  id: string;
  historyId: string;
  recipeId: string;
  householdId: string;
  /** 総合 ★ 1〜5（主評価者） */
  overallRating: number | null;
  tasteSalt: TasteSaltLevel | null;
  tasteSweet: TasteSweetLevel | null;
  tasteSpicy: TasteSpicyLevel | null;
  texture: TextureLevel | null;
  timeFeeling: TimeFeelingLevel | null;
  wantAgain: boolean | null;
  improvementTags: string[];
  memberRatings: FamilyMemberRating[];
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  wantAgainYes: number;
  wantAgainNo: number;
};

export type QuickFeedbackInput = {
  recipeId: string;
  householdId: string;
  createdBy: string | null;
  servings: number;
  cookingTimeActual: number | null;
  overallRating: number | null;
  wantAgain: boolean | null;
  improvementTags: string[];
  memo: string;
  memberRatings?: FamilyMemberRating[];
  tasteSalt?: TasteSaltLevel | null;
  tasteSweet?: TasteSweetLevel | null;
  tasteSpicy?: TasteSpicyLevel | null;
  texture?: TextureLevel | null;
  timeFeeling?: TimeFeelingLevel | null;
};
