import type { IngredientType } from "@/types/ingredient-meta";
import type { ShoppingCategory } from "@/types/shopping-category";

/** 数量行（単位違いを同居させる） */
export type ShoppingQuantity = {
  quantity: number | null;
  unit: string;
  note: string;
};

/** どの料理でどれだけ使うかの内訳 */
export type ShoppingItemSource = {
  recipeId: string | null;
  recipeName: string;
  mealItemId: string | null;
  date: string;
  quantity: number | null;
  unit: string;
  note: string;
};

/** 買い物リスト上の表示区分 */
export type ShoppingListKind = "buy" | "pantryCheck";

/**
 * 食材グループ単位の買い物項目。
 * 同じ正規化名を1カードにまとめる。
 */
export type ShoppingListItem = {
  id: string;
  ingredientName: string;
  checked: boolean;
  manuallyAdded: boolean;
  ingredientType: IngredientType;
  /** buy: 買うもの / pantryCheck: 常備品の確認 */
  listKind: ShoppingListKind;
  quantities: ShoppingQuantity[];
  sources: ShoppingItemSource[];
  /** 余り食材との一致に関する確認メモ */
  leftoverNote?: string | null;
  /** 買い物カテゴリ（野菜・肉など） */
  shoppingCategory?: ShoppingCategory;
};

/** 週単位の買い物リスト */
export type ShoppingList = {
  id: string;
  weekStart: string;
  createdAt: string;
  updatedAt: string;
  items: ShoppingListItem[];
};

/** 手動追加・編集用入力 */
export type ShoppingListItemInput = {
  ingredientName: string;
  quantity: number | null;
  unit: string;
  note: string;
  ingredientType?: IngredientType;
};

/** 献立から集計した中間グループ（UI非依存） */
export type AggregatedIngredientGroup = {
  ingredientName: string;
  ingredientType: IngredientType;
  quantities: ShoppingQuantity[];
  sources: ShoppingItemSource[];
};
