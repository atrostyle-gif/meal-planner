import type { IngredientType, StockStatus } from "@/types/ingredient-meta";

/** 常備品の在庫状態（食材名単位） */
export type PantryStockItem = {
  /** 正規化済みキー */
  key: string;
  displayName: string;
  ingredientType: Extract<IngredientType, "pantrySeasoning" | "pantryFood">;
  stockStatus: StockStatus;
  updatedAt: string;
};
