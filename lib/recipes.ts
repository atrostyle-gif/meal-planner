import { migrateIngredient, toIngredient } from "@/lib/ingredient";
import {
  hasValidStepsArray,
  migrateSteps,
  toRecipeSteps,
} from "@/lib/recipe-steps";
import { resolveNutritionFields } from "@/lib/recipe-nutrition";
import { createSampleRecipes } from "@/lib/sample-recipes";
import {
  applyYoutubeRecipeNamePrefixIfNeeded,
  isYoutubeRecipe,
} from "@/lib/recipe-import/youtube-recipe";
import {
  hasStorageKey,
  readStorage,
  STORAGE_KEYS,
  writeStorage,
} from "@/lib/storage";

/** サンプルを一度投入・初期化したか（欠落しても再投入しない） */
export function areSampleRecipesInitialized(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.localStorage.getItem(STORAGE_KEYS.sampleRecipesInitialized) ===
    "true"
  );
}

/** ユーザーがサンプルを削除したか（同期 pull でも復活させない） */
export function areSampleRecipesDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.localStorage.getItem(STORAGE_KEYS.sampleRecipesDismissed) === "true"
  );
}

function markSampleRecipesInitialized(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.sampleRecipesInitialized, "true");
}

function markSampleRecipesDismissed(): void {
  if (typeof window === "undefined") return;
  markSampleRecipesInitialized();
  window.localStorage.setItem(STORAGE_KEYS.sampleRecipesDismissed, "true");
}

function clearSampleRecipesDismissed(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEYS.sampleRecipesDismissed);
}
import {
  DEFAULT_RECIPE_CATEGORY,
  DEFAULT_RECIPE_COURSE,
  DEFAULT_SERVINGS,
  isRecipeCategory,
  isRecipeCourse,
  type Ingredient,
  type Recipe,
  type RecipeInput,
} from "@/types/recipe";

type Listener = () => void;

let cachedRaw: string | null | undefined = undefined;
let cachedRecipes: Recipe[] = [];
const listeners = new Set<Listener>();

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim();
    if (trimmed === "" || tags.includes(trimmed)) {
      continue;
    }
    tags.push(trimmed);
  }
  return tags;
}

function migrateIngredients(value: unknown): Ingredient[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const ingredients: Ingredient[] = [];
  for (const item of value) {
    const ingredient = migrateIngredient(item);
    if (ingredient === null) {
      return null;
    }
    ingredients.push(ingredient);
  }
  return ingredients;
}

function normalizeServings(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return DEFAULT_SERVINGS;
}

function normalizeCookingTimeMinutes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed);
    }
  }
  return null;
}

/**
 * 旧データも含めて Recipe に正規化する。
 */
function migrateRecipe(value: unknown): Recipe | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    (item.memo !== undefined && typeof item.memo !== "string") ||
    typeof item.createdAt !== "string" ||
    typeof item.updatedAt !== "string"
  ) {
    return null;
  }

  const ingredients = migrateIngredients(item.ingredients);
  if (ingredients === null) {
    return null;
  }

  const category = isRecipeCategory(item.category)
    ? item.category
    : DEFAULT_RECIPE_CATEGORY;
  const tags = normalizeTags(item.tags);
  const importMethod =
    item.importMethod === "manual" ||
    item.importMethod === "url" ||
    item.importMethod === "photo" ||
    item.importMethod === "youtube"
      ? item.importMethod
      : null;
  const source =
    typeof item.source === "object" && item.source !== null
      ? (item.source as Recipe["source"])
      : null;
  const name = applyYoutubeRecipeNamePrefixIfNeeded(
    item.name,
    source,
    importMethod,
  );
  const nutrition = resolveNutritionFields(item, {
    name,
    tags,
    category,
  });

  return {
    id: item.id,
    name,
    ingredients,
    steps: migrateSteps(item.steps, item.instructions),
    memo: typeof item.memo === "string" ? item.memo : undefined,
    category,
    course: isRecipeCourse(item.course) ? item.course : DEFAULT_RECIPE_COURSE,
    tags,
    servings: normalizeServings(item.servings),
    cookingTimeMinutes: normalizeCookingTimeMinutes(item.cookingTimeMinutes),
    ...nutrition,
    cookingProfile:
      typeof item.cookingProfile === "object" && item.cookingProfile !== null
        ? item.cookingProfile as Recipe["cookingProfile"]
        : null,
    importMethod,
    source,
    mealAffinity:
      typeof item.mealAffinity === "object" && item.mealAffinity !== null
        ? item.mealAffinity as Recipe["mealAffinity"]
        : null,
    extractionWarnings: Array.isArray(item.extractionWarnings)
      ? item.extractionWarnings.filter((warning): warning is string => typeof warning === "string")
      : [],
    isSample: item.isSample === true,
    averageRating:
      typeof item.averageRating === "number" ? item.averageRating : null,
    cookCount: typeof item.cookCount === "number" ? item.cookCount : null,
    lastCookedAt:
      typeof item.lastCookedAt === "string" ? item.lastCookedAt : null,
    familyFavoriteScore:
      typeof item.familyFavoriteScore === "number"
        ? item.familyFavoriteScore
        : null,
    improvementCount:
      typeof item.improvementCount === "number" ? item.improvementCount : null,
    favoriteByUsers: Array.isArray(item.favoriteByUsers)
      ? item.favoriteByUsers.filter((id): id is string => typeof id === "string")
      : [],
    wantAgainYes: typeof item.wantAgainYes === "number" ? item.wantAgainYes : 0,
    wantAgainNo: typeof item.wantAgainNo === "number" ? item.wantAgainNo : 0,
    parentRecipeId:
      typeof item.parentRecipeId === "string" ? item.parentRecipeId : null,
    isFamilyVariant: item.isFamilyVariant === true,
    variantSummary:
      typeof item.variantSummary === "string" ? item.variantSummary : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function isStructuredIngredient(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.name === "string" &&
    !("amount" in item) &&
    "quantity" in item &&
    "unit" in item &&
    "note" in item &&
    "ingredientType" in item
  );
}

function needsMigration(raw: unknown, migrated: Recipe): boolean {
  if (typeof raw !== "object" || raw === null) {
    return true;
  }

  const item = raw as Record<string, unknown>;

  if (!isRecipeCategory(item.category)) {
    return true;
  }
  if (!Array.isArray(item.tags)) {
    return true;
  }
  if (JSON.stringify(normalizeTags(item.tags)) !== JSON.stringify(migrated.tags)) {
    return true;
  }
  if (!Array.isArray(item.ingredients)) {
    return true;
  }

  const hasLegacyIngredient = item.ingredients.some(
    (ingredient) =>
      typeof ingredient === "object" &&
      ingredient !== null &&
      "amount" in ingredient,
  );
  if (hasLegacyIngredient) {
    return true;
  }

  if (!item.ingredients.every(isStructuredIngredient)) {
    return true;
  }

  const missingIngredientType = item.ingredients.some(
    (ingredient) =>
      typeof ingredient !== "object" ||
      ingredient === null ||
      !("ingredientType" in ingredient),
  );
  if (missingIngredientType) {
    return true;
  }

  // servings / cookingTime / steps / course の追加マイグレーション
  if (typeof item.servings !== "number" || item.servings !== migrated.servings) {
    return true;
  }
  if (!("cookingTimeMinutes" in item)) {
    return true;
  }
  if (!isRecipeCourse(item.course)) {
    return true;
  }
  if (!hasValidStepsArray(item.steps)) {
    return true;
  }
  // 旧 instructions が残っている場合は steps へ移して書き戻す
  if (typeof item.instructions === "string" && item.instructions.trim() !== "") {
    return true;
  }

  if (!("isSample" in item) || item.isSample !== migrated.isSample) {
    return true;
  }

  // 献立エンジン v2 用フィールドの不足補完
  const nutritionKeys = [
    "calories",
    "protein",
    "fat",
    "carbohydrates",
    "salt",
    "vegetables",
    "proteinType",
    "season",
    "difficulty",
    "favoriteScore",
    "healthyScore",
  ] as const;
  for (const key of nutritionKeys) {
    if (!(key in item)) {
      return true;
    }
  }

  for (const key of ["importMethod", "source", "mealAffinity", "extractionWarnings"]) {
    if (!(key in item)) {
      return true;
    }
  }

  // YouTubeレシピ名の【YouTube】プレフィックス補完
  if (
    isYoutubeRecipe(migrated) &&
    typeof item.name === "string" &&
    item.name !== migrated.name
  ) {
    return true;
  }

  return false;
}

function parseAndMigrateRecipes(value: unknown): {
  recipes: Recipe[];
  migrated: boolean;
} | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const recipes: Recipe[] = [];
  let migrated = false;

  for (const item of value) {
    const recipe = migrateRecipe(item);
    if (recipe === null) {
      return null;
    }
    if (needsMigration(item, recipe)) {
      migrated = true;
    }
    recipes.push(recipe);
  }

  return { recipes, migrated };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function writeRecipes(recipes: Recipe[]): void {
  writeStorage(STORAGE_KEYS.recipes, recipes);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.recipes);
  cachedRecipes = recipes;
}

function persist(recipes: Recipe[]): void {
  writeRecipes(recipes);
  notify();
}

/**
 * レシピ一覧を返す。
 * サンプル投入は「初回のみ」。
 * 一度削除されたサンプルは、キー欠落やリロードでは再生成しない。
 */
export function loadRecipes(): Recipe[] {
  if (typeof window === "undefined") {
    return [];
  }

  if (!hasStorageKey(STORAGE_KEYS.recipes)) {
    // 初回インストール時のみサンプルを投入する
    if (!areSampleRecipesInitialized() && !areSampleRecipesDismissed()) {
      const samples = createSampleRecipes();
      writeRecipes(samples);
      markSampleRecipesInitialized();
      return samples;
    }
    // 既に初期化済み／削除済み → 空配列を保存してキーを確保（再シード防止）
    markSampleRecipesInitialized();
    writeRecipes([]);
    return [];
  }

  // 既存データがある場合は初期化済みとみなす（後方互換）
  if (!areSampleRecipesInitialized()) {
    markSampleRecipesInitialized();
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.recipes);
  if (raw === cachedRaw && cachedRaw !== undefined) {
    return cachedRecipes;
  }

  const stored = readStorage<unknown>(STORAGE_KEYS.recipes);
  const parsed = parseAndMigrateRecipes(stored);

  if (parsed === null) {
    writeRecipes([]);
    return [];
  }

  if (parsed.migrated) {
    writeRecipes(parsed.recipes);
    return parsed.recipes;
  }

  cachedRaw = raw;
  cachedRecipes = parsed.recipes;
  return parsed.recipes;
}

export function subscribeRecipes(onStoreChange: Listener): () => void {
  listeners.add(onStoreChange);

  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEYS.recipes || event.key === null) {
      cachedRaw = undefined;
      onStoreChange();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getRecipesSnapshot(): Recipe[] {
  return loadRecipes();
}

/** SSR 用の安定参照（毎回新しい配列を返すと無限ループになる） */
const EMPTY_RECIPES_SNAPSHOT: Recipe[] = [];

export function getRecipesServerSnapshot(): Recipe[] {
  return EMPTY_RECIPES_SNAPSHOT;
}

export function getRecipeById(id: string): Recipe | null {
  return loadRecipes().find((recipe) => recipe.id === id) ?? null;
}

function buildRecipeFields(input: RecipeInput): Omit<
  Recipe,
  "id" | "createdAt" | "updatedAt" | "isSample"
> {
  const servings =
    Number.isInteger(input.servings) && input.servings >= 1
      ? input.servings
      : DEFAULT_SERVINGS;

  return {
    name: applyYoutubeRecipeNamePrefixIfNeeded(
      input.name.trim(),
      input.source,
      input.importMethod,
    ),
    ingredients: input.ingredients
      .filter((item) => item.name.trim() !== "")
      .map((item) => toIngredient(item)),
    steps: toRecipeSteps(input.steps),
    memo: input.memo.trim() || undefined,
    category: isRecipeCategory(input.category)
      ? input.category
      : DEFAULT_RECIPE_CATEGORY,
    course: isRecipeCourse(input.course) ? input.course : DEFAULT_RECIPE_COURSE,
    tags: normalizeTags(input.tags),
    servings,
    cookingTimeMinutes: normalizeCookingTimeMinutes(input.cookingTimeMinutes),
    calories: input.calories,
    protein: input.protein,
    fat: input.fat,
    carbohydrates: input.carbohydrates,
    salt: input.salt,
    vegetables: input.vegetables,
    nutritionStatus: input.nutritionStatus ?? null,
    caloriesKcal: input.caloriesKcal ?? null,
    carbohydratesG: input.carbohydratesG ?? null,
    sugarsG: input.sugarsG ?? null,
    dietaryFiberG: input.dietaryFiberG ?? null,
    proteinG: input.proteinG ?? null,
    fatG: input.fatG ?? null,
    saturatedFatG: input.saturatedFatG ?? null,
    sodiumMg: input.sodiumMg ?? null,
    saltEquivalentG: input.saltEquivalentG ?? null,
    nutritionCoverage:
      typeof input.nutritionCoverage === "number"
        ? input.nutritionCoverage
        : null,
    calculationSource: input.calculationSource ?? null,
    proteinType: input.proteinType,
    season: input.season,
    difficulty: input.difficulty,
    favoriteScore: input.favoriteScore,
    healthyScore: input.healthyScore,
    cookingProfile: input.cookingProfile ?? null,
    importMethod: input.importMethod ?? null,
    source: input.source ?? null,
    mealAffinity: input.mealAffinity ?? null,
    extractionWarnings: input.extractionWarnings ?? [],
  };
}

export function createRecipe(input: RecipeInput): Recipe {
  const now = new Date().toISOString();
  const recipe: Recipe = {
    id: crypto.randomUUID(),
    ...buildRecipeFields(input),
    isSample: false,
    createdAt: now,
    updatedAt: now,
  };

  persist([recipe, ...loadRecipes()]);
  return recipe;
}

/** サンプルレシピ（isSample: true）をすべて削除する */
export function removeSampleRecipes(): number {
  const recipes = loadRecipes();
  const next = recipes.filter((recipe) => !recipe.isSample);
  const removed = recipes.length - next.length;
  // 削除＝ユーザー意思。自動再投入・同期 pull での復活を禁止する
  markSampleRecipesDismissed();
  persist(next);
  return removed;
}

/**
 * 検証用サンプルを投入し直す（設定画面からの明示操作のみ）。
 * 既存のサンプルは削除し、ユーザー作成レシピは残す。
 */
export function resetSampleRecipes(): number {
  clearSampleRecipesDismissed();
  markSampleRecipesInitialized();
  const userRecipes = loadRecipes().filter((recipe) => !recipe.isSample);
  const samples = createSampleRecipes();
  persist([...samples, ...userRecipes]);
  return samples.length;
}

export function updateRecipe(id: string, input: RecipeInput): Recipe | null {
  const recipes = loadRecipes();
  const index = recipes.findIndex((recipe) => recipe.id === id);

  if (index === -1) {
    return null;
  }

  const updated: Recipe = {
    ...recipes[index],
    ...buildRecipeFields(input),
    updatedAt: new Date().toISOString(),
  };

  const next = [...recipes];
  next[index] = updated;
  persist(next);
  return updated;
}

export function deleteRecipe(id: string): boolean {
  const recipes = loadRecipes();
  const target = recipes.find((recipe) => recipe.id === id);
  const next = recipes.filter((recipe) => recipe.id !== id);

  if (next.length === recipes.length) {
    return false;
  }

  // サンプルを消して残りが無い／一括相当になったら、再シードと pull 復活を禁止
  if (target?.isSample && !next.some((recipe) => recipe.isSample)) {
    markSampleRecipesDismissed();
  }

  persist(next);
  return true;
}

/** repository / 移行用に一覧を丸ごと置き換える */
export function replaceRecipes(recipes: Recipe[]): void {
  persist(recipes);
}
