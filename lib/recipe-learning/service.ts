import { addCookingHistory, loadCookingHistory } from "@/lib/cooking-history";
import { refreshFamilyLearningProfile } from "@/lib/family-learning/store";
import {
  getFeedbacksForRecipe,
  saveCookingFeedback,
} from "@/lib/recipe-learning/cooking-feedbacks";
import { saveRecipeVariant } from "@/lib/recipe-learning/recipe-variants";
import { refreshRecipeLearningStats } from "@/lib/recipe-learning/stats";
import {
  createRecipe,
  loadRecipes,
  getRecipeById,
  replaceRecipes,
} from "@/lib/recipes";
import { getImprovementTagById } from "@/types/recipe-learning";
import type {
  CookingFeedback,
  QuickFeedbackInput,
  RecipeVariant,
} from "@/types/recipe-learning";
import type { RecipeInput } from "@/types/recipe";

function clampMemo(memo: string): string {
  return memo.trim().slice(0, 500);
}

/**
 * 「作った」＋クイック／詳細フィードバックを一括保存し、学習統計を更新する。
 */
export function recordCookingWithFeedback(
  input: QuickFeedbackInput,
): { historyId: string; feedback: CookingFeedback } {
  const memo = clampMemo(input.memo);
  const tags = [...new Set(input.improvementTags)];
  const history = addCookingHistory({
    householdId: input.householdId,
    recipeId: input.recipeId,
    cookedByMemberId: input.createdBy,
    createdBy: input.createdBy,
    difficultyFeedback: null,
    durationMinutes: input.cookingTimeActual,
    cookingTimeActual: input.cookingTimeActual,
    servings: input.servings,
    successRating: input.overallRating,
    notes: memo || null,
    memo: memo || null,
    wantAgain: input.wantAgain,
    improvementTags: tags,
  });

  const now = new Date().toISOString();
  const cookedAt = input.cookedAt ?? history.cookedAt ?? now;
  const feedback: CookingFeedback = {
    id: crypto.randomUUID(),
    historyId: history.id,
    recipeId: input.recipeId,
    householdId: input.householdId,
    cookedAt,
    createdBy: input.createdBy,
    overallRating: input.overallRating,
    tasteSalt: input.tasteSalt ?? null,
    tasteSweet: input.tasteSweet ?? null,
    tasteSpicy: input.tasteSpicy ?? null,
    texture: input.texture ?? null,
    timeFeeling: input.timeFeeling ?? null,
    wantAgain: input.wantAgain,
    cookingTimeActualMinutes: input.cookingTimeActual,
    servingsActual: input.servings,
    improvementTags: tags,
    memberRatings: input.memberRatings ?? [],
    adjustments: input.adjustments ?? [],
    seasoningAdjustments: input.seasoningAdjustments ?? [],
    photoDataUrl: input.photoDataUrl ?? null,
    memo: memo || null,
    createdAt: now,
    updatedAt: now,
  };
  saveCookingFeedback(feedback);
  refreshRecipeLearningStats(input.recipeId);
  refreshFamilyLearningProfile(input.householdId);
  return { historyId: history.id, feedback };
}

/**
 * 改善タグと履歴から我が家版レシピを作成する（親は変更しない）。
 */
export function createFamilyRecipeVariant(input: {
  parentRecipeId: string;
  householdId: string;
  title?: string;
  extraChanges?: string[];
}): RecipeVariant | null {
  const parent = getRecipeById(input.parentRecipeId);
  if (!parent) return null;

  const feedbacks = getFeedbacksForRecipe(input.parentRecipeId);
  const histories = loadCookingHistory().filter(
    (h) => h.recipeId === input.parentRecipeId,
  );
  const tagIds = [
    ...new Set(feedbacks.flatMap((f) => f.improvementTags)),
  ];
  const changes = [
    ...tagIds.map((id) => getImprovementTagById(id)?.label ?? id),
    ...(input.extraChanges ?? []),
  ].filter(Boolean);

  if (changes.length === 0) {
    changes.push("家庭の好みを反映した調整版");
  }

  const summary = changes.slice(0, 6).join(" / ");
  const title =
    input.title?.trim() || `${parent.name}（我が家版）`;

  const recipeInput: RecipeInput = {
    name: title,
    ingredients: parent.ingredients.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      note: item.note,
      ingredientType: item.ingredientType,
    })),
    steps: parent.steps.map((step) => ({ text: step.text })),
    memo: [
      parent.memo ?? "",
      "",
      "【我が家版メモ】",
      ...changes.map((c) => `・${c}`),
      "",
      `元レシピ: ${parent.name}`,
    ]
      .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
      .join("\n"),
    category: parent.category,
    course: parent.course,
    tags: [...new Set([...parent.tags, "我が家版"])],
    servings: parent.servings,
    cookingTimeMinutes: parent.cookingTimeMinutes,
    calories: parent.calories,
    protein: parent.protein,
    fat: parent.fat,
    carbohydrates: parent.carbohydrates,
    salt: parent.salt,
    vegetables: parent.vegetables,
    nutritionStatus: parent.nutritionStatus,
    caloriesKcal: parent.caloriesKcal,
    carbohydratesG: parent.carbohydratesG,
    sugarsG: parent.sugarsG,
    dietaryFiberG: parent.dietaryFiberG,
    proteinG: parent.proteinG,
    fatG: parent.fatG,
    saturatedFatG: parent.saturatedFatG,
    sodiumMg: parent.sodiumMg,
    saltEquivalentG: parent.saltEquivalentG,
    nutritionCoverage: parent.nutritionCoverage,
    calculationSource: parent.calculationSource,
    proteinType: parent.proteinType,
    season: parent.season,
    difficulty: parent.difficulty,
    favoriteScore: parent.favoriteScore,
    healthyScore: parent.healthyScore,
    cookingProfile: parent.cookingProfile,
    importMethod: parent.importMethod ?? "manual",
    source: parent.source,
    mealAffinity: parent.mealAffinity,
    extractionWarnings: [],
  };

  const variantRecipe = createRecipe(recipeInput);
  // 親リンクを付与
  const recipes = loadRecipes().map((recipe) =>
    recipe.id === variantRecipe.id
      ? {
          ...recipe,
          parentRecipeId: parent.id,
          isFamilyVariant: true,
          variantSummary: summary,
        }
      : recipe,
  );
  replaceRecipes(recipes);

  const now = new Date().toISOString();
  const variant: RecipeVariant = {
    id: crypto.randomUUID(),
    parentRecipeId: parent.id,
    variantRecipeId: variantRecipe.id,
    title,
    summary,
    changes,
    sourceHistoryIds: histories.map((h) => h.id),
    sourceFeedbackIds: feedbacks.map((f) => f.id),
    householdId: input.householdId,
    createdAt: now,
    updatedAt: now,
  };
  saveRecipeVariant(variant);
  refreshRecipeLearningStats(variantRecipe.id);
  return variant;
}

/** 我が家版を作れるか（改善タグ or 評価が一定以上ある） */
export function canCreateFamilyVariant(recipeId: string): boolean {
  const feedbacks = getFeedbacksForRecipe(recipeId);
  const tagCount = feedbacks.reduce(
    (sum, f) => sum + f.improvementTags.length,
    0,
  );
  const cookCount = loadCookingHistory().filter(
    (h) => h.recipeId === recipeId,
  ).length;
  return cookCount >= 1 && (tagCount >= 1 || feedbacks.length >= 1);
}
