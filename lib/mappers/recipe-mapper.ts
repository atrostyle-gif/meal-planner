import { migrateIngredient } from "@/lib/ingredient";
import { migrateSteps } from "@/lib/recipe-steps";
import { resolveNutritionFields } from "@/lib/recipe-nutrition";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import {
  DEFAULT_RECIPE_CATEGORY,
  DEFAULT_RECIPE_COURSE,
  DEFAULT_SERVINGS,
  isRecipeCategory,
  isRecipeCourse,
  type Recipe,
  type RecipeInput,
} from "@/types/recipe";
import type { RecipeCookingProfile } from "@/types/weekly-lifestyle";
import type { RecipeMealAffinity, RecipeSource } from "@/types/recipe-import";

type RecipeRow = Tables<"recipes">;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asCookingProfile(value: Json | null): RecipeCookingProfile | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as unknown as RecipeCookingProfile)
    : null;
}

function asObject<T>(value: Json | null): T | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as unknown as T)
    : null;
}

function asStringArray(value: Json | null): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function recipeFromRow(row: RecipeRow): Recipe {
  const ingredients = asArray(row.ingredients)
    .map((item) => migrateIngredient(item))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const category = isRecipeCategory(row.category) ? row.category : DEFAULT_RECIPE_CATEGORY;
  const tags = asArray(row.tags).filter((tag): tag is string => typeof tag === "string");
  const nutrition = resolveNutritionFields(
    {
      // DB に未保存の栄養項目は推定で補完
    },
    { name: row.name, tags, category },
  );

  return {
    id: row.id,
    name: row.name,
    category,
    course: isRecipeCourse(row.course) ? row.course : DEFAULT_RECIPE_COURSE,
    tags,
    servings:
      typeof row.servings === "number" && row.servings >= 1
        ? row.servings
        : DEFAULT_SERVINGS,
    cookingTimeMinutes: row.cooking_time_minutes,
    ingredients,
    steps: migrateSteps(row.steps, undefined),
    memo: row.notes ?? undefined,
    cookingProfile: asCookingProfile(row.cooking_profile),
    importMethod: row.import_method as Recipe["importMethod"],
    source: asObject<RecipeSource>(row.source),
    mealAffinity: asObject<RecipeMealAffinity>(row.meal_affinity),
    extractionWarnings: asStringArray(row.extraction_warnings),
    ...nutrition,
    isSample: row.is_sample === true,
    householdId: row.household_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function recipeToInsert(
  recipe: Recipe | (RecipeInput & { id?: string; isSample?: boolean }),
  householdId: string,
  userId: string | null,
): TablesInsert<"recipes"> {
  const now = new Date().toISOString();
  const id = "id" in recipe && typeof recipe.id === "string" ? recipe.id : undefined;
  const isSample = "isSample" in recipe ? recipe.isSample === true : false;

  return {
    id,
    household_id: householdId,
    name: recipe.name.trim(),
    category: recipe.category,
    course: recipe.course,
    servings: recipe.servings,
    cooking_time_minutes: recipe.cookingTimeMinutes,
    tags: recipe.tags,
    ingredients:
      "ingredients" in recipe
        ? recipe.ingredients.map((item) =>
            "id" in item
              ? item
              : {
                  id: crypto.randomUUID(),
                  name: item.name,
                  quantity: item.quantity,
                  unit: item.unit,
                  note: item.note,
                  ingredientType: item.ingredientType,
                },
          )
        : [],
    steps:
      "steps" in recipe
        ? "id" in (recipe.steps[0] ?? {})
          ? recipe.steps
          : recipe.steps.map((step, index) => ({
              id: crypto.randomUUID(),
              order: index + 1,
              text: "text" in step ? step.text : "",
            }))
        : [],
    cooking_profile:
      "cookingProfile" in recipe && recipe.cookingProfile
        ? (recipe.cookingProfile as unknown as Json)
        : null,
    import_method: recipe.importMethod ?? null,
    source: recipe.source ? (recipe.source as unknown as Json) : null,
    meal_affinity: recipe.mealAffinity ? (recipe.mealAffinity as unknown as Json) : null,
    extraction_warnings: recipe.extractionWarnings ?? [],
    notes:
      "memo" in recipe && typeof recipe.memo === "string"
        ? recipe.memo.trim() || null
        : null,
    is_sample: isSample,
    created_by: userId,
    updated_by: userId,
    created_at: "createdAt" in recipe ? recipe.createdAt : now,
    updated_at: "updatedAt" in recipe ? recipe.updatedAt : now,
  };
}

export function recipeToUpdate(
  input: RecipeInput,
  userId: string | null,
): TablesUpdate<"recipes"> {
  return {
    name: input.name.trim(),
    category: input.category,
    course: input.course,
    servings: input.servings,
    cooking_time_minutes: input.cookingTimeMinutes,
    tags: input.tags,
    ingredients: input.ingredients.map((item) => ({
      id: crypto.randomUUID(),
      name: item.name.trim(),
      quantity: item.quantity,
      unit: item.unit.trim(),
      note: item.note.trim(),
      ingredientType: item.ingredientType,
    })),
    steps: input.steps.map((step, index) => ({
      id: crypto.randomUUID(),
      order: index + 1,
      text: step.text.trim(),
    })),
    notes: input.memo.trim() || null,
    cooking_profile: input.cookingProfile
      ? (input.cookingProfile as unknown as Json)
      : null,
    import_method: input.importMethod ?? null,
    source: input.source ? (input.source as unknown as Json) : null,
    meal_affinity: input.mealAffinity ? (input.mealAffinity as unknown as Json) : null,
    extraction_warnings: input.extractionWarnings ?? [],
    updated_by: userId,
  };
}
