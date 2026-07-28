import { evaluateRecipeHardConstraints } from "@/lib/allergy/check";
import { evaluateCookSuitability, resolveRecipeCookingProfile } from "@/lib/cooking-suitability";
import {
  buildDayRecommendation,
  createEmptyProteinCounts,
  scoreRecipeCandidate,
  type WeekCategoryFlags,
  type WeekProteinCounts,
} from "@/lib/meal-planner-engine/score";
import {
  evaluateMealCombination,
  optimizeDayMeal,
  type MealPlanProposal,
  type OptimizeContext,
  type ProposedDayMeal,
} from "@/lib/meal-planner-engine/v3";
import { evaluateCandidateAgainstMealSet } from "@/lib/meal-planner-engine/meal-set";
import {
  isCurryOrStew,
  isDonburiDish,
  isFriedDish,
  isNoodleDish,
} from "@/lib/recipe-nutrition";
import { AUTO_FILL_COURSES, type RecipeCourse } from "@/types/course";
import type { AutoFillMode, DailyConditionOption } from "@/types/daily-condition";
import type { DayMeal, MealDishItem } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import type {
  CookingHistory,
  CookingMemberProfile,
  DailyCookingOverride,
  EffortLevel,
  LifestyleAutoFillMode,
  WeeklyCookingSchedule,
} from "@/types/weekly-lifestyle";
import type { LeftoverIngredient } from "@/types/leftover-ingredient";
import type { FoodAliasMapping } from "@/types/food-master";
import { dateToDayOfWeek } from "@/types/weekly-lifestyle";
import {
  evaluateAdditionalPurchaseNeeds,
  evaluateLeftoverIngredientUsage,
  evaluateRepeatedIngredientPenalty,
} from "@/lib/leftover-match";

export type OptimizeContextV4 = OptimizeContext & {
  schedules: WeeklyCookingSchedule[];
  cookingProfiles: CookingMemberProfile[];
  overrides: DailyCookingOverride[];
  cookingHistory: CookingHistory[];
  householdId: string;
  memberDisplayNames: Record<string, string>;
  /** 余っている食材（未入力でも空配列で従来どおり） */
  leftovers?: LeftoverIngredient[];
  foodAliases?: FoodAliasMapping[];
};

export type WeekIngredientUsage = Record<string, number>;

type LifestyleFit = {
  points: number;
  reasons: string[];
  blocked: boolean;
};

type LifestyleScore = {
  points: number;
  reasons: string[];
};

function effortRank(level: EffortLevel | null): number {
  switch (level) {
    case "very_easy":
      return 1;
    case "easy":
      return 2;
    case "normal":
      return 3;
    case "elaborate":
      return 4;
    case "unrestricted":
    case null:
      return 5;
  }
}

function ingredientKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

function findCook(
  schedule: WeeklyCookingSchedule | null,
  override: DailyCookingOverride | null,
  profiles: CookingMemberProfile[],
): CookingMemberProfile | null {
  const memberId = override?.cookMemberId ?? schedule?.defaultCookMemberId ?? null;
  if (!memberId) return null;
  return (
    profiles.find(
      (profile) =>
        profile.isActive &&
        (profile.familyMemberProfileId === memberId || profile.id === memberId),
    ) ?? null
  );
}

function getSchedule(
  date: string,
  context: OptimizeContextV4,
): WeeklyCookingSchedule | null {
  return (
    context.schedules.find(
      (schedule) =>
        schedule.isActive &&
        schedule.dayOfWeek === dateToDayOfWeek(date) &&
        (schedule.householdId === context.householdId || schedule.householdId === "local"),
    ) ?? null
  );
}

function getOverride(
  date: string,
  context: OptimizeContextV4,
): DailyCookingOverride | null {
  return (
    context.overrides.find(
      (override) =>
        override.date === date &&
        (override.householdId === context.householdId || override.householdId === "local"),
    ) ?? null
  );
}

function emptyProposal(date: string, reason: string): ProposedDayMeal {
  return {
    date,
    items: [],
    evaluation: { score: 0, reasons: [reason], warnings: [] },
    recommendation: { score: 0, stars: 0, reasons: [reason] },
  };
}

/** 当日の生活条件に対するレシピの適合度を評価する。 */
export function evaluateDayLifestyleFit(
  schedule: WeeklyCookingSchedule | null,
  override: DailyCookingOverride | null,
  recipe: Recipe,
  cook: CookingMemberProfile | null,
): LifestyleFit {
  const profile = resolveRecipeCookingProfile(recipe);
  const suitability = evaluateCookSuitability(recipe, cook);
  const reasons: string[] = [];
  const limit = override?.cookingTimeLimitMinutes ?? schedule?.cookingTimeLimitMinutes ?? null;
  const minutes = profile.totalCookingMinutes ?? recipe.cookingTimeMinutes;
  const effort = override?.effortLevel ?? schedule?.effortLevel ?? null;

  if (suitability.blocked) {
    return { points: 0, reasons: suitability.reasons, blocked: true };
  }
  if (
    cook?.dislikedCookingMethods.includes("揚げ物") &&
    profile.requiresDeepFrying
  ) {
    return { points: 0, reasons: ["担当者が避けたい揚げ物です"], blocked: true };
  }
  if (
    cook?.dislikedCookingMethods.includes("オーブン") &&
    profile.requiresOven
  ) {
    return { points: 0, reasons: ["担当者が避けたいオーブン料理です"], blocked: true };
  }
  if (
    cook?.dislikedCookingMethods.includes("圧力鍋") &&
    profile.requiresPressureCooker
  ) {
    return { points: 0, reasons: ["担当者が避けたい圧力鍋料理です"], blocked: true };
  }
  if (
    cook?.dislikedCookingMethods.includes("生魚") &&
    profile.requiresRawFishHandling
  ) {
    return { points: 0, reasons: ["担当者が避けたい生魚を扱う料理です"], blocked: true };
  }
  if (
    profile.assignedCookMemberIds.length > 0 &&
    (!cook || !profile.assignedCookMemberIds.includes(cook.familyMemberProfileId))
  ) {
    return { points: 0, reasons: ["担当者が指定されている料理です"], blocked: true };
  }
  if (limit != null && minutes != null && minutes > limit) {
    return { points: 0, reasons: ["当日の調理時間内に収まりません"], blocked: true };
  }
  if (
    schedule?.maxStepCount != null &&
    (profile.stepCount ?? recipe.steps.length) > schedule.maxStepCount
  ) {
    return { points: 0, reasons: ["当日の工程数の上限を超えます"], blocked: true };
  }
  if (schedule?.avoidDeepFrying && profile.requiresDeepFrying) {
    return { points: 0, reasons: ["この日は揚げ物を避ける予定です"], blocked: true };
  }
  if (cook?.cookingLevel === "beginner" && profile.difficulty === "hard") {
    return { points: 0, reasons: ["初心者には難しい料理です"], blocked: true };
  }

  let points = 0;
  if (schedule?.preferFamiliarRecipes && cook?.masteredRecipeIds.includes(recipe.id)) {
    points += 18;
    reasons.push("担当者が作り慣れた料理です");
  }
  if (schedule?.preferLowCleanup && profile.cleanupLevel === "low") {
    points += 10;
    reasons.push("洗い物が少ない料理を選びました");
  }
  if (effort !== null && effortRank(profile.effortLevel) <= effortRank(effort)) {
    points += 8;
    reasons.push("当日の手間に合う料理です");
  }
  if (schedule?.allowBatchCooking && profile.canBatchCook) {
    points += 8;
    reasons.push("作り置きにも向く料理です");
  }
  if (schedule?.preferMakeAhead && profile.makeAheadSuitable) {
    points += 8;
    reasons.push("事前に準備しやすい料理です");
  }
  if (schedule?.shoppingAvailable && schedule.isShoppingDay && effort === "elaborate") {
    points += 6;
    reasons.push("買い出し可能なため、手の込んだ料理を選びました");
  }
  return { points, reasons, blocked: false };
}

/** 担当者の実績を加味してレシピを評価する。 */
export function evaluateRecipeForCook(
  recipe: Recipe,
  cook: CookingMemberProfile | null,
  cookingHistory: CookingHistory[],
): LifestyleFit {
  const suitability = evaluateCookSuitability(recipe, cook);
  if (suitability.blocked) {
    return { points: 0, reasons: suitability.reasons, blocked: true };
  }
  if (!cook) return { points: 0, reasons: [], blocked: false };

  const history = cookingHistory.filter(
    (entry) =>
      entry.recipeId === recipe.id &&
      entry.cookedByMemberId === cook.familyMemberProfileId,
  );
  if (cook.masteredRecipeIds.includes(recipe.id) || history.length >= 3) {
    return { points: 16, reasons: ["担当者が作り慣れた料理です"], blocked: false };
  }
  if (cook.preferredRecipeIds.includes(recipe.id)) {
    return { points: 12, reasons: ["担当者の得意な料理です"], blocked: false };
  }
  if (cook.learningRecipeIds.includes(recipe.id)) {
    return { points: 6, reasons: ["担当者が挑戦中の料理です"], blocked: false };
  }
  return { points: 0, reasons: [], blocked: false };
}

/** 週内で使う食材を再利用できるほど評価する（食品ロス削減の参考提案）。 */
export function evaluateWeeklyIngredientReuse(
  weekIngredientUsage: WeekIngredientUsage,
  recipe: Recipe,
  date: string,
  shoppingDayDate: string | null,
): LifestyleScore {
  const reasons: string[] = [];
  let points = 0;
  const used = recipe.ingredients.filter(
    (ingredient) => (weekIngredientUsage[ingredientKey(ingredient.name)] ?? 0) > 0,
  );
  const unusedCount = recipe.ingredients.length - used.length;
  const isShoppingDay = shoppingDayDate === date;
  const overused = recipe.ingredients.some(
    (ingredient) => (weekIngredientUsage[ingredientKey(ingredient.name)] ?? 0) >= 3,
  );

  if (overused) {
    points -= 10;
    reasons.push("同じ食材の使いすぎを避けています");
  }

  if (isShoppingDay && unusedCount > 0) {
    points += 8;
    reasons.push("買い出し日に必要な食材をまとめてそろえられます");
  } else if (!isShoppingDay && shoppingDayDate && unusedCount >= 3) {
    points -= 8;
    reasons.push("買い足しが少なくなる組み合わせを優先しています");
  }

  if (used.length > 0) {
    points += Math.min(used.length * 4, 12);
    reasons.push("週内で使う食材を活用できる料理です");
  }

  return { points, reasons };
}

/** 生活スタイル用の自動生成モードに応じた重みを返す。 */
export function lifestyleModeWeight(
  mode: AutoFillMode | LifestyleAutoFillMode,
  recipe: Recipe,
  schedule: WeeklyCookingSchedule | null,
  cook: CookingMemberProfile | null,
): LifestyleScore {
  const profile = resolveRecipeCookingProfile(recipe);
  switch (mode) {
    case "生活優先":
      return evaluateDayLifestyleFit(schedule, null, recipe, cook);
    case "担当者優先":
      return cook?.preferredRecipeIds.includes(recipe.id) || cook?.masteredRecipeIds.includes(recipe.id)
        ? { points: 14, reasons: ["担当者の得意な料理を優先しました"] }
        : { points: 0, reasons: [] };
    case "作り慣れた料理優先":
      return cook?.masteredRecipeIds.includes(recipe.id)
        ? { points: 20, reasons: ["担当者が作り慣れた料理を選びました"] }
        : { points: -6, reasons: [] };
    case "新しい料理に挑戦":
      return schedule?.allowNewRecipes && !cook?.masteredRecipeIds.includes(recipe.id)
        ? { points: 12, reasons: ["新しい料理に挑戦しやすい日です"] }
        : { points: 0, reasons: [] };
    case "買い足し最小":
      return recipe.ingredients.length <= 5
        ? { points: 8, reasons: ["必要な食材が少ない料理です"] }
        : { points: 0, reasons: [] };
    case "週末に手の込んだ料理":
      return schedule?.effortLevel === "elaborate" && profile.effortLevel === "elaborate"
        ? { points: 14, reasons: ["時間に余裕があるため手の込んだ料理を選びました"] }
        : { points: 0, reasons: [] };
    case "娘でも作りやすい":
      return profile.beginnerFriendly
        ? { points: 18, reasons: ["初心者でも作りやすい料理です"] }
        : { points: 0, reasons: [] };
    default:
      return { points: 0, reasons: [] };
  }
}

function addIngredientUsage(usage: WeekIngredientUsage, recipe: Recipe): void {
  for (const ingredient of recipe.ingredients) {
    const key = ingredientKey(ingredient.name);
    usage[key] = (usage[key] ?? 0) + 1;
  }
}

/** v3 の評価に生活スケジュールを追加した1日分の最適化。 */
export function optimizeDayMealV4(
  date: string,
  existing: DayMeal,
  usedRecipeIds: Set<string>,
  weekProtein: WeekProteinCounts,
  weekFlags: WeekCategoryFlags,
  context: OptimizeContextV4,
  previous: DayMeal | null,
  weekIngredientUsage: WeekIngredientUsage = {},
  shoppingDayDate: string | null = null,
  leftoverUsageCounts: Record<string, number> = {},
): ProposedDayMeal | null {
  const schedule = getSchedule(date, context);
  if (!schedule) {
    return optimizeDayMeal(date, existing, usedRecipeIds, weekProtein, weekFlags, context, previous);
  }
  if (existing.locked || existing.items.length > 0) return null;

  const override = getOverride(date, context);
  if (override?.isEatingOut || override?.skipMealPlanning) {
    return emptyProposal(date, override.isEatingOut ? "外食予定のため献立を作成しません" : "献立作成をスキップします");
  }
  const cook = findCook(schedule, override, context.cookingProfiles);
  const cookingLimit =
    override?.cookingTimeLimitMinutes ??
    schedule.cookingTimeLimitMinutes ??
    context.cookingTimeLimit ??
    context.preferences.cookingTimeLimit;
  const leftovers = context.leftovers ?? [];
  const aliases = context.foodAliases ?? [];
  const allowed = context.recipes.filter((recipe) => {
    if (evaluateRecipeHardConstraints(recipe, context.allergies, context.dietaryRestrictions).blocked) {
      return false;
    }
    const isFamiliar =
      cook != null &&
      (cook.masteredRecipeIds.includes(recipe.id) ||
        context.cookingHistory.some(
          (entry) =>
            entry.recipeId === recipe.id &&
            entry.cookedByMemberId === cook.familyMemberProfileId,
        ));
    if (
      (override?.allowNewRecipes ?? schedule.allowNewRecipes) === false &&
      !isFamiliar
    ) {
      return false;
    }
    const fit = evaluateDayLifestyleFit(schedule, override, recipe, cook);
    return !fit.blocked && (recipe.cookingTimeMinutes == null || recipe.cookingTimeMinutes <= cookingLimit);
  });
  const items: MealDishItem[] = [];
  const picked: Recipe[] = [];
  const scoredPicks: { score: number; reasons: string[]; recipe: Recipe }[] = [];
  const daySoFar = { calories: 0, protein: 0, fat: 0, salt: 0, vegetables: 0 };
  const previousMain = previous?.items.find((item) => item.course === "主菜");
  const previousRecipe = context.recipes.find((recipe) => recipe.id === previousMain?.recipeId) ?? null;

  for (const course of AUTO_FILL_COURSES) {
    const courseRecipes = allowed.filter((recipe) => recipe.course === course);
    const candidates = (courseRecipes.length > 0 ? courseRecipes : allowed).map((recipe) => {
      const base = scoreRecipeCandidate(recipe, {
        course,
        date,
        preferences: context.preferences,
        inventory: context.inventory,
        recentRecipeIds: context.recentRecipeIds,
        usedRecipeIds,
        previousMainProtein: previousRecipe?.proteinType ?? null,
        previousRecipeIds: new Set(previous?.items.map((item) => item.recipeId).filter((id): id is string => Boolean(id)) ?? []),
        previousWasFried: previous ? previous.items.some((item) => {
          const entry = context.recipes.find((recipe) => recipe.id === item.recipeId);
          return entry ? isFriedDish(entry) : false;
        }) : false,
        previousWasNoodle: previous ? previous.items.some((item) => {
          const entry = context.recipes.find((recipe) => recipe.id === item.recipeId);
          return entry ? isNoodleDish(entry) : false;
        }) : false,
        weekProtein,
        weekFlags,
        daySoFar,
        foodMasters: context.foodMasters,
      });
      const fit = evaluateDayLifestyleFit(schedule, override, recipe, cook);
      const cookScore = evaluateRecipeForCook(recipe, cook, context.cookingHistory);
      const leftoverScore = evaluateLeftoverIngredientUsage(
        recipe,
        leftovers,
        context.foodMasters,
        aliases,
      );
      const leftoverRepeat = evaluateRepeatedIngredientPenalty(
        recipe,
        leftovers,
        leftoverUsageCounts,
        context.foodMasters,
        aliases,
      );
      const purchase = evaluateAdditionalPurchaseNeeds(
        recipe,
        leftovers,
        context.foodMasters,
        aliases,
      );
      const reuse = evaluateWeeklyIngredientReuse(weekIngredientUsage, recipe, date, shoppingDayDate);
      const mode = lifestyleModeWeight(context.mode, recipe, schedule, cook);
      const setFit = evaluateCandidateAgainstMealSet(picked, recipe);
      const setReasons = [
        ...setFit.reasons,
        ...(setFit.incompatible ? setFit.warnings.slice(0, 1) : []),
      ];
      return {
        ...base,
        score:
          base.score +
          fit.points +
          cookScore.points +
          leftoverScore.points +
          leftoverRepeat.points +
          purchase.points +
          reuse.points +
          mode.points +
          setFit.points,
        reasons: [
          ...new Set([
            ...base.reasons.filter((reason) => !reason.includes("冷蔵庫")),
            ...fit.reasons,
            ...cookScore.reasons,
            ...leftoverScore.reasons,
            ...leftoverRepeat.reasons,
            ...purchase.reasons,
            ...reuse.reasons,
            ...mode.reasons,
            ...setReasons,
          ]),
        ].slice(0, 6),
        matchedLeftoverIds: leftoverScore.matchedIds,
        breakdown: {
          ...base.breakdown,
          mealSet: setFit.points,
          setIncompatible: setFit.incompatible ? 1 : 0,
        },
      };
    });
    const compatible = candidates.filter(
      (item) => (item.breakdown.setIncompatible ?? 0) === 0,
    );
    const pool = compatible.length > 0 ? compatible : candidates;
    pool.sort(
      (left, right) =>
        right.score - left.score || left.recipe.id.localeCompare(right.recipe.id),
    );
    const best = pool[0];
    if (!best) continue;

    usedRecipeIds.add(best.recipe.id);
    addIngredientUsage(weekIngredientUsage, best.recipe);
    for (const leftoverId of best.matchedLeftoverIds ?? []) {
      leftoverUsageCounts[leftoverId] = (leftoverUsageCounts[leftoverId] ?? 0) + 1;
    }
    picked.push(best.recipe);
    daySoFar.calories += best.recipe.calories ?? 0;
    daySoFar.protein += best.recipe.protein ?? 0;
    daySoFar.fat += best.recipe.fat ?? 0;
    daySoFar.salt += best.recipe.salt ?? 0;
    daySoFar.vegetables += best.recipe.vegetables ?? 0;
    if (best.recipe.proteinType) weekProtein[best.recipe.proteinType] += 1;
    if (isCurryOrStew(best.recipe)) weekFlags.curryOrStew += 1;
    if (isDonburiDish(best.recipe)) weekFlags.donburi += 1;
    items.push({
      id: crypto.randomUUID(),
      recipeId: best.recipe.id,
      course: course as RecipeCourse,
      order: items.length + 1,
      customName: null,
      source: "auto",
      engineScore: best.score,
      engineReasons: best.reasons,
      matchedLeftoverIds: best.matchedLeftoverIds ?? [],
    });
    scoredPicks.push({ score: best.score, reasons: best.reasons, recipe: best.recipe });
  }
  if (items.length === 0) return null;
  const conditions = context.conditionsByDate[date] ??
    ([context.preferences.conditionMode].filter(Boolean) as DailyConditionOption[]);
  const evaluation = evaluateMealCombination(picked, { conditions, mode: context.mode });
  const recommendation = buildDayRecommendation(scoredPicks);
  return {
    date,
    items,
    evaluation,
    recommendation: {
      ...recommendation,
      score: recommendation.score + evaluation.score,
      reasons: [...new Set([...evaluation.reasons, ...recommendation.reasons])].slice(0, 5),
    },
  };
}

/** 週間の食材再利用と生活スケジュールを加味して最適化する。 */
export function optimizeWeeklyMealPlanV4(
  weekStart: string,
  days: DayMeal[],
  context: OptimizeContextV4,
): MealPlanProposal {
  const usedRecipeIds = new Set<string>();
  const weekProtein = createEmptyProteinCounts();
  const weekFlags: WeekCategoryFlags = { curryOrStew: 0, donburi: 0 };
  const weekIngredientUsage: WeekIngredientUsage = {};
  const leftoverUsageCounts: Record<string, number> = {};
  const shoppingDayDate = days.find((day) => getSchedule(day.date, context)?.isShoppingDay)?.date ?? null;
  const proposedDays: ProposedDayMeal[] = [];
  for (let index = 0; index < days.length; index += 1) {
    const day = days[index];
    for (const item of day.items) {
      const recipe = context.recipes.find((entry) => entry.id === item.recipeId);
      if (!recipe) continue;
      usedRecipeIds.add(recipe.id);
      addIngredientUsage(weekIngredientUsage, recipe);
      if (recipe.proteinType) weekProtein[recipe.proteinType] += 1;
      if (isCurryOrStew(recipe)) weekFlags.curryOrStew += 1;
      if (isDonburiDish(recipe)) weekFlags.donburi += 1;
    }
    const proposed = optimizeDayMealV4(
      day.date, day, usedRecipeIds, weekProtein, weekFlags, context,
      index > 0 ? days[index - 1] : null, weekIngredientUsage, shoppingDayDate, leftoverUsageCounts,
    );
    if (proposed) proposedDays.push(proposed);
  }
  return {
    id: crypto.randomUUID(),
    weekStart,
    mode: context.mode,
    days: proposedDays,
    createdAt: new Date().toISOString(),
  };
}
