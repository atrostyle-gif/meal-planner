import type { Recipe } from "@/types/recipe";
import type {
  CookingMemberProfile,
  CleanupLevel,
  EffortLevel,
  RecipeCookingProfile,
  RecipeDifficultyLevel,
  SuitabilityLevel,
} from "@/types/weekly-lifestyle";
import { countCooksByMember } from "@/lib/cooking-history";

export function emptyRecipeCookingProfile(): RecipeCookingProfile {
  return {
    difficulty: null,
    effortLevel: null,
    activeCookingMinutes: null,
    totalCookingMinutes: null,
    stepCount: null,
    cleanupLevel: null,
    requiresDeepFrying: null,
    requiresOven: null,
    requiresPressureCooker: null,
    requiresRawFishHandling: null,
    canBatchCook: null,
    makeAheadSuitable: null,
    beginnerFriendly: null,
    assignedCookMemberIds: [],
    preferredCookMemberIds: [],
    avoidCookMemberIds: [],
    memberSuitability: [],
    source: "estimated",
  };
}

/** 既存レシピから調理適性を推定（手動値は上書きしない） */
export function estimateRecipeCookingProfile(
  recipe: Recipe,
  existing?: RecipeCookingProfile | null,
): RecipeCookingProfile {
  const base = existing ?? emptyRecipeCookingProfile();
  const steps = recipe.steps.length;
  const minutes = recipe.cookingTimeMinutes;
  const blob = `${recipe.name} ${recipe.tags.join(" ")} ${recipe.category}`;

  const estimatedDifficulty: RecipeDifficultyLevel =
    minutes != null && minutes <= 15 && steps <= 4
      ? "very_easy"
      : minutes != null && minutes <= 25 && steps <= 6
        ? "easy"
        : minutes != null && minutes >= 50
          ? "hard"
          : "normal";

  const estimatedEffort: EffortLevel =
    estimatedDifficulty === "very_easy"
      ? "very_easy"
      : estimatedDifficulty === "easy"
        ? "easy"
        : estimatedDifficulty === "hard"
          ? "elaborate"
          : "normal";

  const deepFry = /揚げ|唐揚|天ぷら|フライ|とんかつ/.test(blob);
  const oven = /オーブン|グラタン|ロースト/.test(blob);
  const pressure = /圧力鍋/.test(blob);
  const rawFish = /刺身|寿司|たたき/.test(blob);
  const batch =
    recipe.tags.includes("作り置き") || /作り置き|常備菜/.test(blob);
  const beginner =
    estimatedDifficulty === "very_easy" ||
    estimatedDifficulty === "easy" ||
    recipe.tags.includes("簡単") ||
    recipe.tags.includes("15分以内");

  const cleanup: CleanupLevel = deepFry
    ? "high"
    : steps >= 8
      ? "high"
      : steps <= 4
        ? "low"
        : "medium";

  const isManual = base.source === "manual";

  return {
    difficulty: isManual && base.difficulty ? base.difficulty : estimatedDifficulty,
    effortLevel: isManual && base.effortLevel ? base.effortLevel : estimatedEffort,
    activeCookingMinutes:
      base.activeCookingMinutes ?? minutes,
    totalCookingMinutes: base.totalCookingMinutes ?? minutes,
    stepCount: base.stepCount ?? steps,
    cleanupLevel: isManual && base.cleanupLevel ? base.cleanupLevel : cleanup,
    requiresDeepFrying:
      base.requiresDeepFrying != null ? base.requiresDeepFrying : deepFry,
    requiresOven: base.requiresOven != null ? base.requiresOven : oven,
    requiresPressureCooker:
      base.requiresPressureCooker != null
        ? base.requiresPressureCooker
        : pressure,
    requiresRawFishHandling:
      base.requiresRawFishHandling != null
        ? base.requiresRawFishHandling
        : rawFish,
    canBatchCook: base.canBatchCook != null ? base.canBatchCook : batch,
    makeAheadSuitable:
      base.makeAheadSuitable != null ? base.makeAheadSuitable : batch,
    beginnerFriendly:
      base.beginnerFriendly != null ? base.beginnerFriendly : beginner,
    assignedCookMemberIds: base.assignedCookMemberIds,
    preferredCookMemberIds: base.preferredCookMemberIds,
    avoidCookMemberIds: base.avoidCookMemberIds,
    memberSuitability: base.memberSuitability,
    source: isManual ? "manual" : existing ? "mixed" : "estimated",
  };
}

export function resolveRecipeCookingProfile(recipe: Recipe): RecipeCookingProfile {
  const stored =
    recipe.cookingProfile && typeof recipe.cookingProfile === "object"
      ? recipe.cookingProfile
      : null;
  return estimateRecipeCookingProfile(recipe, stored);
}

/**
 * 担当者にとっての作りやすさ。
 * 明示 unsuitable / avoid は除外対象。
 */
export function evaluateCookSuitability(
  recipe: Recipe,
  cook: CookingMemberProfile | null,
): { suitability: SuitabilityLevel; reasons: string[]; blocked: boolean } {
  const profile = resolveRecipeCookingProfile(recipe);
  const reasons: string[] = [];

  if (!cook) {
    return { suitability: "possible", reasons: ["担当者未設定のため一般評価"], blocked: false };
  }

  if (cook.avoidRecipeIds.includes(recipe.id)) {
    return {
      suitability: "unsuitable",
      reasons: ["この担当者には提案しない設定です"],
      blocked: true,
    };
  }
  if (profile.avoidCookMemberIds.includes(cook.familyMemberProfileId)) {
    return {
      suitability: "unsuitable",
      reasons: ["このレシピでは担当を避ける設定です"],
      blocked: true,
    };
  }

  const manual = profile.memberSuitability.find(
    (entry) => entry.memberId === cook.familyMemberProfileId && entry.source === "manual",
  );
  if (manual) {
    return {
      suitability: manual.suitability,
      reasons: [manual.reason ?? "個別設定の作りやすさ"],
      blocked: manual.suitability === "unsuitable",
    };
  }

  if (profile.requiresDeepFrying && !cook.canDeepFry) {
    return {
      suitability: "unsuitable",
      reasons: ["揚げ物の扱いが難しい設定のため候補から外しました"],
      blocked: true,
    };
  }
  if (profile.requiresOven && !cook.canUseOven) {
    return {
      suitability: "unsuitable",
      reasons: ["オーブンを使わない設定のため候補から外しました"],
      blocked: true,
    };
  }
  if (profile.requiresPressureCooker && !cook.canUsePressureCooker) {
    return {
      suitability: "unsuitable",
      reasons: ["圧力鍋を使わない設定のため候補から外しました"],
      blocked: true,
    };
  }
  if (profile.requiresRawFishHandling && !cook.canHandleRawFish) {
    return {
      suitability: "unsuitable",
      reasons: ["生魚の扱いが難しい設定のため候補から外しました"],
      blocked: true,
    };
  }

  let score = 50;
  const cookCount = countCooksByMember(recipe.id, cook.familyMemberProfileId);

  if (cook.masteredRecipeIds.includes(recipe.id) || cookCount >= 3) {
    score += 30;
    reasons.push("作り慣れた料理です");
  } else if (cook.preferredRecipeIds.includes(recipe.id)) {
    score += 20;
    reasons.push("得意・好みの料理です");
  } else if (cook.learningRecipeIds.includes(recipe.id)) {
    score += 8;
    reasons.push("挑戦中の料理です");
  }

  if (profile.beginnerFriendly && cook.cookingLevel === "beginner") {
    score += 15;
    reasons.push("初心者向けの料理です");
  }
  if (
    cook.cookingLevel === "beginner" &&
    (profile.difficulty === "hard" || profile.difficulty === "normal")
  ) {
    score -= 25;
    reasons.push("この担当者には難しい料理です");
  }

  const minutes = profile.totalCookingMinutes ?? recipe.cookingTimeMinutes;
  if (
    cook.defaultMaxCookingMinutes != null &&
    minutes != null &&
    minutes > cook.defaultMaxCookingMinutes
  ) {
    score -= 20;
    reasons.push(`${cook.defaultMaxCookingMinutes}分以内を超えます`);
  }

  const steps = profile.stepCount ?? recipe.steps.length;
  if (
    cook.maxComfortableStepCount != null &&
    steps > cook.maxComfortableStepCount
  ) {
    score -= 15;
    reasons.push("工程が多めです");
  }

  if (cook.prefersLowCleanup && profile.cleanupLevel === "high") {
    score -= 12;
    reasons.push("洗い物が多めです");
  }

  let suitability: SuitabilityLevel = "possible";
  if (score >= 75) suitability = "comfortable";
  if (score >= 90) suitability = "expert";
  if (score < 40) suitability = "difficult";
  if (score < 20) suitability = "unsuitable";

  const blocked =
    suitability === "unsuitable" ||
    (cook.cookingLevel === "beginner" && profile.difficulty === "hard");

  return { suitability, reasons: reasons.slice(0, 4), blocked };
}
