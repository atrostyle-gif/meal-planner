import {
  FOOD_CATEGORIES,
  isFoodFreezableLevel,
  isFoodStorageType,
  isGlycemicCategory,
  type FoodCategory,
  type FoodIngredientMaster,
  type FoodStorageType,
  type NutritionPer100g,
} from "@/types/food-master";

function isFoodCategory(value: unknown): value is FoodCategory {
  return (
    typeof value === "string" &&
    (FOOD_CATEGORIES as readonly string[]).includes(value)
  );
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asMonthArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is number => typeof v === "number" && v >= 1 && v <= 12,
  );
}

function defaultStorageForCategory(category: FoodCategory): FoodStorageType {
  if (category === "調味料" || category === "油脂" || category === "穀類") {
    return "room_temperature";
  }
  if (category === "肉類" || category === "魚介類" || category === "乳製品") {
    return "refrigerated";
  }
  return "refrigerated";
}

/**
 * 旧マスター行を新スキーマへ補完（破壊せず拡張）。
 */
export function migrateFoodMaster(value: unknown): FoodIngredientMaster | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.canonicalName !== "string") {
    return null;
  }
  if (!isFoodCategory(item.category)) return null;
  const nutrition = item.nutritionPer100g;
  if (typeof nutrition !== "object" || nutrition === null) return null;
  const n = nutrition as Record<string, unknown>;
  if (typeof n.calories !== "number") return null;

  const nutritionPer100g: NutritionPer100g = {
    calories: n.calories,
    protein: typeof n.protein === "number" ? n.protein : 0,
    fat: typeof n.fat === "number" ? n.fat : 0,
    carbohydrates:
      typeof n.carbohydrates === "number" ? n.carbohydrates : 0,
    fiber: typeof n.fiber === "number" ? n.fiber : 0,
    saltEquivalent:
      typeof n.saltEquivalent === "number" ? n.saltEquivalent : 0,
    calcium: typeof n.calcium === "number" ? n.calcium : 0,
    iron: typeof n.iron === "number" ? n.iron : 0,
    vitaminA: typeof n.vitaminA === "number" ? n.vitaminA : null,
    vitaminB1: typeof n.vitaminB1 === "number" ? n.vitaminB1 : null,
    vitaminB2: typeof n.vitaminB2 === "number" ? n.vitaminB2 : null,
    vitaminC: typeof n.vitaminC === "number" ? n.vitaminC : null,
  };

  const now = new Date().toISOString();
  const edibleUnit =
    typeof item.edibleUnit === "string"
      ? item.edibleUnit
      : typeof item.defaultUnit === "string"
        ? item.defaultUnit
        : "g";
  const foodCode =
    typeof item.foodCode === "string" && item.foodCode.trim() !== ""
      ? item.foodCode
      : item.id;

  const pantryType =
    typeof item.pantryType === "string" ? item.pantryType : null;
  let storageType: FoodStorageType | null = isFoodStorageType(item.storageType)
    ? item.storageType
    : null;
  if (!storageType && pantryType) {
    if (/冷凍|frozen/i.test(pantryType)) storageType = "frozen";
    else if (/常温|room/i.test(pantryType)) storageType = "room_temperature";
    else if (/冷蔵|fridge/i.test(pantryType)) storageType = "refrigerated";
  }
  if (!storageType) {
    storageType = defaultStorageForCategory(item.category);
  }

  const nutritionReference =
    typeof item.nutritionReference === "object" &&
    item.nutritionReference !== null
      ? {
          provider:
            (item.nutritionReference as { provider?: string }).provider ===
              "foods_json" ||
            (item.nutritionReference as { provider?: string }).provider ===
              "external"
              ? ((
                  item.nutritionReference as {
                    provider: "foods_json" | "external";
                  }
                ).provider)
              : ("embedded" as const),
          foodCode:
            typeof (item.nutritionReference as { foodCode?: unknown })
              .foodCode === "string"
              ? (item.nutritionReference as { foodCode: string }).foodCode
              : null,
          note:
            typeof (item.nutritionReference as { note?: unknown }).note ===
            "string"
              ? (item.nutritionReference as { note: string }).note
              : null,
        }
      : {
          provider: "embedded" as const,
          foodCode: null,
          note: null,
        };

  return {
    id: item.id,
    foodCode,
    canonicalName: item.canonicalName,
    aliases: asStringArray(item.aliases),
    category: item.category,
    subcategory:
      typeof item.subcategory === "string" ? item.subcategory : null,
    defaultUnit:
      typeof item.defaultUnit === "string" ? item.defaultUnit : edibleUnit,
    edibleUnit,
    gramsPerUnit:
      typeof item.gramsPerUnit === "number" ? item.gramsPerUnit : null,
    gramsPerTablespoon:
      typeof item.gramsPerTablespoon === "number"
        ? item.gramsPerTablespoon
        : null,
    gramsPerTeaspoon:
      typeof item.gramsPerTeaspoon === "number" ? item.gramsPerTeaspoon : null,
    density: typeof item.density === "number" ? item.density : null,
    nutritionPer100g,
    nutritionReference,
    seasonMonths: asMonthArray(item.seasonMonths),
    storageType,
    freezable: isFoodFreezableLevel(item.freezable) ? item.freezable : null,
    recommendedShelfLifeDays:
      typeof item.recommendedShelfLifeDays === "number"
        ? item.recommendedShelfLifeDays
        : null,
    glycemicCategory: isGlycemicCategory(item.glycemicCategory)
      ? item.glycemicCategory
      : "unknown",
    diabetesFriendly:
      typeof item.diabetesFriendly === "boolean"
        ? item.diabetesFriendly
        : null,
    commonPackageSizes: asStringArray(item.commonPackageSizes),
    commonStores: asStringArray(item.commonStores),
    typicalCookingMethods: asStringArray(item.typicalCookingMethods),
    substituteFoods: asStringArray(item.substituteFoods),
    pantryType,
    source: typeof item.source === "string" ? item.source : null,
    sourceVersion:
      typeof item.sourceVersion === "string" ? item.sourceVersion : null,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

export function migrateFoodMasters(values: unknown[]): FoodIngredientMaster[] {
  return values
    .map((value) => migrateFoodMaster(value))
    .filter((item): item is FoodIngredientMaster => item !== null);
}
