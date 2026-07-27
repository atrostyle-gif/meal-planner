import { findFoodMaster } from "@/lib/food-master/match";
import { loadFoodAliasMappings, loadFoodMasters } from "@/lib/food-master/store";
import { normalizeIngredientName } from "@/lib/food-master/normalize";
import { parseAmountString } from "@/lib/ingredient";
import { applyAutomaticNutritionToRecipeInput } from "@/lib/nutrition/recipe-nutrition";
import { parseIngredientLine } from "@/lib/recipe-import/parse-ingredient";
import {
  DEFAULT_INGREDIENT_TYPE,
  DEFAULT_RECIPE_CATEGORY,
  DEFAULT_RECIPE_COURSE,
  DEFAULT_SERVINGS,
  isRecipeCategory,
  isRecipeCourse,
  type RecipeCategory,
  type RecipeCourse,
  type Recipe,
  type RecipeInput,
} from "@/types/recipe";
import type {
  ImportCuisine,
  ImportMealRole,
  ImportStapleType,
  RecipeDraft,
  RecipeMealAffinity,
  RecipeSource,
} from "@/types/recipe-import";
import { emptyRecipeCookingProfile } from "@/lib/cooking-suitability";

function cuisineToCategory(cuisine: ImportCuisine | null | undefined): RecipeCategory {
  switch (cuisine) {
    case "japanese":
      return "和食";
    case "western":
      return "洋食";
    case "italian":
      return "イタリアン";
    case "chinese":
      return "中華";
    case "korean":
      return "韓国";
    default:
      return DEFAULT_RECIPE_CATEGORY;
  }
}

function mealRoleToCourse(role: ImportMealRole | null | undefined): RecipeCourse {
  switch (role) {
    case "staple":
      return "主食";
    case "main":
      return "主菜";
    case "side":
      return "副菜";
    case "soup":
      return "汁物";
    case "salad":
      return "副菜";
    case "dessert":
      return "デザート";
    case "one_dish":
      return "主食";
    default:
      return DEFAULT_RECIPE_COURSE;
  }
}

function enrichIngredientName(name: string): {
  name: string;
  foodMasterId: string | null;
  needsReview: boolean;
} {
  if (typeof window === "undefined") {
    return { name, foodMasterId: null, needsReview: false };
  }
  const masters = loadFoodMasters();
  const aliases = loadFoodAliasMappings();
  const aliasMap = new Map(
    aliases.map((item) => [normalizeIngredientName(item.aliasName), item.masterId]),
  );
  const match = findFoodMaster(name, masters, aliasMap);
  if (match.master && (match.confidence === "exact" || match.confidence === "alias")) {
    return {
      name: match.master.canonicalName,
      foodMasterId: match.master.id,
      needsReview: false,
    };
  }
  return {
    name,
    foodMasterId: match.master?.id ?? null,
    needsReview: match.needsReview || match.confidence === "partial",
  };
}

/** quantity 欠落時に quantityText / 原文から復元する */
function resolveDraftQuantity(item: {
  quantity?: number | null;
  quantityText?: string | null;
  unit?: string | null;
  rawText?: string | null;
  name: string;
}): { quantity: number | null; unit: string } {
  const unit = item.unit?.trim() || "";
  const quantityText = item.quantityText?.trim() || "";

  if (
    item.quantity !== null &&
    item.quantity !== undefined &&
    Number.isFinite(item.quantity)
  ) {
    return {
      quantity: item.quantity,
      unit: unit || quantityText,
    };
  }

  // 「1/3」+「束」→「1/3束」
  if (quantityText !== "") {
    const combined =
      unit !== "" && !quantityText.includes(unit)
        ? `${quantityText}${unit}`
        : quantityText;
    const parsed = parseAmountString(combined);
    if (parsed && parsed.quantity !== null) {
      return parsed;
    }
  }

  if (unit !== "") {
    const fromUnit = parseAmountString(unit);
    if (fromUnit && fromUnit.quantity !== null) {
      return fromUnit;
    }
  }

  if (item.rawText && item.rawText.trim() !== "" && item.rawText !== item.name) {
    const parsed = parseIngredientLine(item.rawText);
    if (parsed.quantity !== null) {
      return {
        quantity: parsed.quantity,
        unit: parsed.unit?.trim() || unit || quantityText,
      };
    }
  }

  return {
    quantity: null,
    unit: unit || quantityText,
  };
}

/** RecipeDraft → 既存 RecipeInput（未保存） */
export function recipeDraftToRecipeInput(draft: RecipeDraft): RecipeInput {
  const category =
    (draft.category && isRecipeCategory(draft.category)
      ? draft.category
      : cuisineToCategory(draft.cuisine)) ?? DEFAULT_RECIPE_CATEGORY;
  const course = mealRoleToCourse(draft.mealRole);

  const ingredients = draft.ingredients
    .filter((item) => item.name.trim() !== "")
    .map((item) => {
      const enriched = enrichIngredientName(item.name.trim());
      const resolved = resolveDraftQuantity(item);
      return {
        name: enriched.name,
        quantity: resolved.quantity,
        unit: resolved.unit,
        note: [
          item.groupName ? `【${item.groupName}】` : null,
          item.alias ? `別名: ${item.alias}` : null,
          item.note,
          item.rawText !== item.name ? `原文: ${item.rawText}` : null,
        ]
          .filter(Boolean)
          .join(" / "),
        ingredientType: DEFAULT_INGREDIENT_TYPE,
      };
    });

  const steps = draft.steps
    .filter((step) => step.text.trim() !== "")
    .sort((a, b) => a.order - b.order)
    .map((step) => ({ text: step.text.trim() }));

  const cookingMinutes =
    draft.totalTimeMinutes ?? draft.cookTimeMinutes ?? draft.prepTimeMinutes ?? null;

  const affinity = buildMealAffinityFromDraft(draft);
  const source = buildSourceFromDraft(draft);

  const baseInput: RecipeInput = {
    name: (draft.title ?? "").trim() || "無題のレシピ",
    ingredients,
    steps,
    memo: [draft.description, draft.warnings?.length ? `読み取り注意: ${draft.warnings.join(" / ")}` : null]
      .filter(Boolean)
      .join("\n\n"),
    category,
    course: isRecipeCourse(course) ? course : DEFAULT_RECIPE_COURSE,
    tags: draft.tags ?? [],
    servings:
      draft.servings && draft.servings >= 1 ? Math.floor(draft.servings) : DEFAULT_SERVINGS,
    cookingTimeMinutes: cookingMinutes,
    calories: null,
    protein: null,
    fat: null,
    carbohydrates: null,
    salt: null,
    vegetables: null,
    proteinType: null,
    season: null,
    difficulty: null,
    favoriteScore: null,
    healthyScore: null,
    cookingProfile: {
      ...emptyRecipeCookingProfile(),
      source: "estimated",
    },
    source,
    mealAffinity: affinity,
    importMethod: draft.importMethod,
    extractionWarnings: draft.warnings ?? [],
  };

  // 食品DBから栄養を自動計算（手入力が後から入れば優先）
  return applyAutomaticNutritionToRecipeInput(baseInput);
}

export function buildMealAffinityFromDraft(draft: RecipeDraft): RecipeMealAffinity {
  return {
    cuisine: draft.cuisine ?? "unknown",
    mealRole: draft.mealRole ?? "main",
    stapleType: draft.stapleType ?? "unknown",
    mealStyle: draft.mealStyle ?? "unknown",
    flavorTraits: draft.flavorTraits ?? [],
    source: "imported",
  };
}

export function buildSourceFromDraft(draft: RecipeDraft): RecipeSource {
  return {
    type: draft.importMethod,
    title: draft.sourceTitle ?? draft.title ?? null,
    url: draft.sourceUrl ?? null,
    author: draft.sourceAuthor ?? null,
    importedAt: draft.importedAt ?? new Date().toISOString(),
    note: null,
  };
}

export function stapleTypeLabel(staple: ImportStapleType): string {
  return staple;
}

/** 取り込み確認フォーム用の未保存 Recipe を組み立てる。 */
export function recipeInputToTemporaryRecipe(input: RecipeInput): Recipe {
  const now = new Date().toISOString();
  return {
    id: `import-${crypto.randomUUID()}`,
    name: input.name,
    ingredients: input.ingredients.map((ingredient) => ({
      ...ingredient,
      id: crypto.randomUUID(),
    })),
    steps: input.steps.map((step, index) => ({
      id: crypto.randomUUID(),
      order: index + 1,
      text: step.text,
    })),
    memo: input.memo,
    category: input.category,
    course: input.course,
    tags: input.tags,
    servings: input.servings,
    cookingTimeMinutes: input.cookingTimeMinutes,
    calories: input.calories,
    protein: input.protein,
    fat: input.fat,
    carbohydrates: input.carbohydrates,
    salt: input.salt,
    vegetables: input.vegetables,
    proteinType: input.proteinType,
    season: input.season,
    difficulty: input.difficulty,
    favoriteScore: input.favoriteScore,
    healthyScore: input.healthyScore,
    cookingProfile: input.cookingProfile,
    importMethod: input.importMethod,
    source: input.source,
    mealAffinity: input.mealAffinity,
    extractionWarnings: input.extractionWarnings,
    isSample: false,
    createdAt: now,
    updatedAt: now,
  };
}
