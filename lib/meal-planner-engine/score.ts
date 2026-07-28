import {
  isFoodInSeason,
  resolveFoodMaster,
} from "@/lib/food-master/resolve";
import {
  countPriorityIngredientMatches,
  getPriorityInventoryItems,
} from "@/lib/recipe-inventory-match";
import {
  getSeasonForDate,
  isCurryOrStew,
  isDonburiDish,
  isFriedDish,
  isNoodleDish,
  scoreToStars,
} from "@/lib/recipe-nutrition";
import { parseDate } from "@/lib/date";
import type { FoodIngredientMaster } from "@/types/food-master";
import type { InventoryItem } from "@/types/inventory";
import type {
  ConditionMode,
  HealthGoal,
  HouseholdPreferences,
} from "@/types/meal-preferences";
import type { ProteinType, RecipeSeason } from "@/types/recipe-nutrition";
import type { Recipe } from "@/types/recipe";
import type { RecipeCourse } from "@/types/course";
import type { ScoredRecipeCandidate } from "@/lib/meal-planner-engine/types";

/** 1食あたりの栄養目標 */
export const MEAL_NUTRITION_TARGETS = {
  caloriesMin: 500,
  caloriesMax: 800,
  proteinMin: 20,
  vegetablesMin: 120,
  saltMax: 3,
} as const;

export type WeekProteinCounts = Record<ProteinType, number>;

export type WeekCategoryFlags = {
  curryOrStew: number;
  donburi: number;
};

export function createEmptyProteinCounts(): WeekProteinCounts {
  return {
    牛: 0,
    豚: 0,
    鶏: 0,
    魚: 0,
    卵: 0,
    大豆: 0,
    なし: 0,
  };
}

type ScoreContext = {
  course: RecipeCourse;
  date: string;
  preferences: HouseholdPreferences;
  inventory: InventoryItem[];
  recentRecipeIds: string[];
  usedRecipeIds: Set<string>;
  /** 前日の主菜タンパク */
  previousMainProtein: ProteinType | null;
  /** 前日のレシピ ID 群 */
  previousRecipeIds: Set<string>;
  /** 前日が揚げ物か */
  previousWasFried: boolean;
  /** 前日が麺か */
  previousWasNoodle: boolean;
  weekProtein: WeekProteinCounts;
  weekFlags: WeekCategoryFlags;
  /** 同日すでに選んだ料理の合計栄養（追加前） */
  daySoFar: {
    calories: number;
    protein: number;
    fat: number;
    salt: number;
    vegetables: number;
  };
  /** Food Master（旬・健康判定） */
  foodMasters?: FoodIngredientMaster[];
};

function addReason(
  reasons: string[],
  breakdown: Record<string, number>,
  key: string,
  points: number,
  label: string,
): void {
  if (points === 0) {
    return;
  }
  breakdown[key] = (breakdown[key] ?? 0) + points;
  reasons.push(label);
}

function conditionBonus(
  recipe: Recipe,
  mode: ConditionMode,
  currentSeason: RecipeSeason,
): { points: number; label: string | null } {
  const healthy = recipe.healthyScore ?? 0;
  const time = recipe.cookingTimeMinutes;
  const fried = isFriedDish(recipe);
  const season = recipe.season;

  switch (mode) {
    case "疲れている":
      if (time !== null && time <= 20) {
        return { points: 20, label: "体調（疲れ）に合う時短メニュー" };
      }
      if ((recipe.difficulty ?? 5) <= 2) {
        return { points: 15, label: "体調（疲れ）に合う簡単な料理" };
      }
      return { points: 0, label: null };
    case "風邪気味":
      if (
        recipe.category === "鍋" ||
        recipe.category === "スープ" ||
        /鍋|スープ|おじや|おかゆ/.test(recipe.name)
      ) {
        return { points: 20, label: "体調（風邪気味）に合う温かい料理" };
      }
      if (healthy >= 3) {
        return { points: 12, label: "体調（風邪気味）向けのヘルシーさ" };
      }
      return { points: 0, label: null };
    case "胃腸が弱い":
      if (fried) {
        return { points: -20, label: "体調（胃腸）に揚げ物は控えめ" };
      }
      if (healthy >= 3 || recipe.category === "スープ") {
        return { points: 20, label: "体調（胃腸）に合うやさしい料理" };
      }
      return { points: 0, label: null };
    case "暑い日":
      if (season === "夏" || currentSeason === "夏") {
        if (season === "夏" || recipe.category === "サラダ") {
          return { points: 20, label: "暑い日に合うさっぱりメニュー" };
        }
      }
      if (fried) {
        return { points: -10, label: "暑い日は揚げ物を控えめ" };
      }
      return { points: 0, label: null };
    case "寒い日":
      if (
        season === "冬" ||
        recipe.category === "鍋" ||
        /鍋|シチュー|おでん/.test(recipe.name)
      ) {
        return { points: 20, label: "寒い日に合う温かい料理" };
      }
      return { points: 0, label: null };
    case "スタミナを付けたい":
      if (
        recipe.proteinType === "牛" ||
        recipe.proteinType === "豚" ||
        (recipe.protein ?? 0) >= 25
      ) {
        return { points: 20, label: "スタミナを付けたい日に合う" };
      }
      return { points: 0, label: null };
    default:
      return { points: 0, label: null };
  }
}

function healthGoalBonus(
  recipe: Recipe,
  goal: HealthGoal,
  cookingTimeLimit: number,
): { points: number; label: string | null } {
  switch (goal) {
    case "ダイエット":
      if (recipe.calories !== null && recipe.calories <= 450) {
        return { points: 12, label: "ダイエット目標のカロリー" };
      }
      if (isFriedDish(recipe)) {
        return { points: -12, label: "ダイエット中は揚げ物を控えめ" };
      }
      return { points: 0, label: null };
    case "筋力アップ":
      if ((recipe.protein ?? 0) >= 25) {
        return { points: 15, label: "筋力アップ向けのたんぱく質" };
      }
      return { points: 0, label: null };
    case "減塩":
      if (recipe.salt !== null && recipe.salt <= 1.5) {
        return { points: 12, label: "減塩目標に合う" };
      }
      if ((recipe.salt ?? 0) > 3) {
        return { points: -15, label: "塩分が高め" };
      }
      return { points: 0, label: null };
    case "野菜多め":
      if ((recipe.vegetables ?? 0) >= 80) {
        return { points: 15, label: "野菜多めの目標に合う" };
      }
      return { points: 0, label: null };
    case "時短":
      if (
        recipe.cookingTimeMinutes !== null &&
        recipe.cookingTimeMinutes <= Math.min(cookingTimeLimit, 30)
      ) {
        return { points: 12, label: "時短目標に合う" };
      }
      return { points: 0, label: null };
    case "節約":
      if (recipe.tags.includes("節約") || (recipe.favoriteScore ?? 0) >= 0) {
        if (recipe.tags.includes("節約")) {
          return { points: 10, label: "節約タグの料理" };
        }
      }
      return { points: 0, label: null };
    default:
      return { points: 0, label: null };
  }
}

function weeklyProteinAdjustment(
  proteinType: ProteinType | null,
  counts: WeekProteinCounts,
): { points: number; label: string | null } {
  if (!proteinType || proteinType === "なし") {
    return { points: 0, label: null };
  }
  const count = counts[proteinType];
  if (proteinType === "魚") {
    if (count < 2) {
      return { points: 10, label: "魚不足を補えます" };
    }
    if (count >= 3) {
      return { points: -8, label: "今週の魚が多め" };
    }
  }
  if (proteinType === "鶏" && count >= 2) {
    return { points: -6, label: "今週の鶏が多め" };
  }
  if (proteinType === "豚" && count >= 2) {
    return { points: -6, label: "今週の豚が多め" };
  }
  if (proteinType === "牛" && count >= 1) {
    return { points: -8, label: "今週の牛は控えめに" };
  }
  return { points: 0, label: null };
}

/**
 * 1レシピをルールベースでスコアリングする。
 */
export function scoreRecipeCandidate(
  recipe: Recipe,
  ctx: ScoreContext,
): ScoredRecipeCandidate {
  const reasons: string[] = [];
  const breakdown: Record<string, number> = {};
  let score = 0;

  const priorityItems = getPriorityInventoryItems(ctx.inventory);
  const fridgeHits = countPriorityIngredientMatches(recipe, priorityItems);
  if (fridgeHits > 0) {
    const points = Math.min(30, fridgeHits * 15);
    addReason(
      reasons,
      breakdown,
      "fridge",
      points,
      `余っている食材を${fridgeHits}品使えます`,
    );
    score += points;
  }

  if (!ctx.recentRecipeIds.includes(recipe.id) && !ctx.usedRecipeIds.has(recipe.id)) {
    addReason(reasons, breakdown, "fresh", 20, "最近作っていない料理です");
    score += 20;
  } else if (ctx.usedRecipeIds.has(recipe.id)) {
    addReason(reasons, breakdown, "dupWeek", -10, "今週すでに選んだ料理");
    score -= 10;
  }

  const currentSeason = getSeasonForDate(parseDate(ctx.date));
  if (recipe.season === currentSeason) {
    addReason(reasons, breakdown, "season", 15, `季節（${currentSeason}）に合います`);
    score += 15;
  } else if (recipe.season === "通年") {
    addReason(reasons, breakdown, "season", 5, "通年向けの料理");
    score += 5;
  } else if (recipe.season !== null) {
    addReason(reasons, breakdown, "seasonOff", -8, "季節外の料理");
    score -= 8;
  }

  // Food Master 経由の旬加点
  if (ctx.foodMasters && ctx.foodMasters.length > 0) {
    const month = parseDate(ctx.date).getMonth() + 1;
    let inSeasonCount = 0;
    for (const ingredient of recipe.ingredients) {
      const hit = resolveFoodMaster(ingredient.name, {
        masters: ctx.foodMasters,
      });
      if (isFoodInSeason(hit.master, month) === true) {
        inSeasonCount += 1;
      }
    }
    if (inSeasonCount > 0) {
      const points = Math.min(12, inSeasonCount * 4);
      addReason(
        reasons,
        breakdown,
        "foodMasterSeason",
        points,
        `旬の食材を${inSeasonCount}品使えます`,
      );
      score += points;
    }
  }

  const cond = conditionBonus(recipe, ctx.preferences.conditionMode, currentSeason);
  if (cond.points !== 0 && cond.label) {
    addReason(reasons, breakdown, "condition", cond.points, cond.label);
    score += cond.points;
  }

  const goal = healthGoalBonus(
    recipe,
    ctx.preferences.healthGoal,
    ctx.preferences.cookingTimeLimit,
  );
  if (goal.points !== 0 && goal.label) {
    addReason(reasons, breakdown, "goal", goal.points, goal.label);
    score += goal.points;
  }

  // カロリー（1食トータル見込みで主に主菜を評価）
  const projectedCal =
    ctx.daySoFar.calories + (recipe.calories ?? 0);
  if (recipe.calories !== null) {
    if (
      projectedCal >= MEAL_NUTRITION_TARGETS.caloriesMin &&
      projectedCal <= MEAL_NUTRITION_TARGETS.caloriesMax
    ) {
      addReason(reasons, breakdown, "cal", 15, `${Math.round(recipe.calories)}kcal`);
      score += 15;
    } else if (projectedCal > MEAL_NUTRITION_TARGETS.caloriesMax + 150) {
      addReason(reasons, breakdown, "calHigh", -10, "カロリーが高め");
      score -= 10;
    }
  }

  const projectedVeg =
    ctx.daySoFar.vegetables + (recipe.vegetables ?? 0);
  if ((recipe.vegetables ?? 0) >= 80) {
    addReason(
      reasons,
      breakdown,
      "veg",
      15,
      `野菜${Math.round(recipe.vegetables ?? 0)}g`,
    );
    score += 15;
  } else if (
    projectedVeg < MEAL_NUTRITION_TARGETS.vegetablesMin &&
    (recipe.vegetables ?? 0) > 0
  ) {
    addReason(reasons, breakdown, "vegHelp", 8, "野菜不足を補えます");
    score += 8;
  }

  const fishAdj = weeklyProteinAdjustment(recipe.proteinType, ctx.weekProtein);
  if (fishAdj.points !== 0 && fishAdj.label) {
    addReason(reasons, breakdown, "proteinWeek", fishAdj.points, fishAdj.label);
    score += fishAdj.points;
  }

  if (
    recipe.cookingTimeMinutes !== null &&
    recipe.cookingTimeMinutes <= ctx.preferences.cookingTimeLimit
  ) {
    addReason(
      reasons,
      breakdown,
      "time",
      10,
      `調理${recipe.cookingTimeMinutes}分`,
    );
    score += 10;
  } else if (
    recipe.cookingTimeMinutes !== null &&
    recipe.cookingTimeMinutes > ctx.preferences.cookingTimeLimit
  ) {
    addReason(reasons, breakdown, "timeOver", -12, "調理時間の上限超え");
    score -= 12;
  }

  if (
    recipe.proteinType &&
    recipe.proteinType !== "なし" &&
    ctx.previousMainProtein === recipe.proteinType &&
    ctx.course === "主菜"
  ) {
    addReason(reasons, breakdown, "sameMeat", -20, "昨日と同じ肉を回避したい");
    score -= 20;
  }

  if (ctx.previousRecipeIds.has(recipe.id)) {
    addReason(reasons, breakdown, "sameDish", -30, "前日と同じ料理");
    score -= 30;
  }

  const projectedFat = ctx.daySoFar.fat + (recipe.fat ?? 0);
  if (recipe.fat !== null && projectedFat > 35) {
    addReason(reasons, breakdown, "fat", -15, "脂質オーバー気味");
    score -= 15;
  }

  const projectedSalt = ctx.daySoFar.salt + (recipe.salt ?? 0);
  if (recipe.salt !== null && projectedSalt > MEAL_NUTRITION_TARGETS.saltMax) {
    addReason(reasons, breakdown, "salt", -20, "塩分オーバー気味");
    score -= 20;
  }

  if ((recipe.favoriteScore ?? 0) >= 4) {
    addReason(reasons, breakdown, "fav", 8, "家族の好みが高い料理");
    score += 8;
  }

  // 週間カテゴリ制約
  if (isFriedDish(recipe) && ctx.previousWasFried) {
    addReason(reasons, breakdown, "friedSeq", -25, "揚げ物の連続を回避");
    score -= 25;
  }
  if (isNoodleDish(recipe) && ctx.previousWasNoodle) {
    addReason(reasons, breakdown, "noodleSeq", -25, "麺類の連続を回避");
    score -= 25;
  }
  if (isCurryOrStew(recipe) && ctx.weekFlags.curryOrStew >= 1) {
    addReason(reasons, breakdown, "curryWeek", -30, "カレー・シチューは週1まで");
    score -= 30;
  }
  if (isDonburiDish(recipe) && ctx.weekFlags.donburi >= 2) {
    addReason(reasons, breakdown, "donWeek", -20, "丼は週2以内");
    score -= 20;
  }

  // コース一致ボーナス
  if (recipe.course === ctx.course) {
    score += 5;
    breakdown.courseFit = 5;
  }

  return {
    recipe,
    course: ctx.course,
    score,
    reasons: reasons.slice(0, 6),
    breakdown,
  };
}

export function buildDayRecommendation(
  items: { score: number; reasons: string[]; recipe: Recipe }[],
): { score: number; stars: number; reasons: string[] } {
  const score = items.reduce((sum, item) => sum + item.score, 0);
  const stars = scoreToStars(score / Math.max(items.length, 1));

  const reasonSet: string[] = [];
  for (const item of items) {
    for (const reason of item.reasons) {
      // おすすめ理由はプラス要因のみ表示
      if (/回避|オーバー|控えめ|超え|多め|季節外|すでに選んだ/.test(reason)) {
        continue;
      }
      if (!reasonSet.includes(reason) && reasonSet.length < 5) {
        reasonSet.push(reason);
      }
    }
  }

  // 日合計の栄養サマリーを末尾に追加
  const calories = items.reduce(
    (sum, item) => sum + (item.recipe.calories ?? 0),
    0,
  );
  const vegetables = items.reduce(
    (sum, item) => sum + (item.recipe.vegetables ?? 0),
    0,
  );
  if (calories > 0 && !reasonSet.some((r) => r.includes("kcal"))) {
    reasonSet.push(`合計約${Math.round(calories)}kcal`);
  }
  if (vegetables > 0 && !reasonSet.some((r) => r.includes("野菜"))) {
    reasonSet.push(`野菜合計約${Math.round(vegetables)}g`);
  }

  return { score, stars, reasons: reasonSet.slice(0, 5) };
}
