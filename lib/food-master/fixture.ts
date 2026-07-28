import { migrateFoodMaster } from "@/lib/food-master/migrate";
import type {
  FoodCategory,
  FoodIngredientMaster,
  NutritionPer100g,
} from "@/types/food-master";

const EMPTY_NUTRITION: NutritionPer100g = {
  calories: 0,
  protein: 0,
  fat: 0,
  carbohydrates: 0,
  fiber: 0,
  saltEquivalent: 0,
  calcium: 0,
  iron: 0,
};

/** テスト用の最小 Food Master */
export function foodMasterFixture(
  partial: Partial<FoodIngredientMaster> & {
    id: string;
    canonicalName: string;
    category: FoodCategory;
  },
): FoodIngredientMaster {
  const migrated = migrateFoodMaster({
    edibleUnit: "g",
    gramsPerUnit: 1,
    nutritionPer100g: EMPTY_NUTRITION,
    aliases: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  });
  if (!migrated) {
    throw new Error(`foodMasterFixture failed for ${partial.id}`);
  }
  return migrated;
}
