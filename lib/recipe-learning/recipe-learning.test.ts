import { beforeEach, describe, expect, it, vi } from "vitest";
import { replaceCookingHistory, loadCookingHistory } from "@/lib/cooking-history";
import {
  replaceCookingFeedbacks,
  loadCookingFeedbacks,
  getFeedbacksForRecipe,
} from "@/lib/recipe-learning/cooking-feedbacks";
import {
  replaceRecipeVariants,
  loadRecipeVariants,
  getVariantsForParent,
} from "@/lib/recipe-learning/recipe-variants";
import {
  recordCookingWithFeedback,
  createFamilyRecipeVariant,
  canCreateFamilyVariant,
} from "@/lib/recipe-learning/service";
import {
  computeRecipeLearningStats,
  refreshRecipeLearningStats,
} from "@/lib/recipe-learning/stats";
import {
  MockRecipeImprovementProvider,
  NoOpRecipeImprovementProvider,
} from "@/lib/recipe-learning/improvement-provider";
import {
  createLocalCookingHistoryRepository,
  createLocalCookingFeedbackRepository,
  createLocalRecipeVariantRepository,
} from "@/lib/repositories/recipe-learning-repository";
import { replaceRecipes, loadRecipes, getRecipeById } from "@/lib/recipes";
import { scoreRecipeForSlot, type ScoreContext } from "@/lib/weekly-auto-plan/score";
import type { Recipe } from "@/types/recipe";

function stubLocalStorage(): void {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("window", {
    localStorage: localStorageMock,
    dispatchEvent: () => true,
  });
  vi.stubGlobal(
    "CustomEvent",
    class CustomEvent<T> {
      detail: T | undefined;
      constructor(_type: string, init?: { detail?: T }) {
        this.detail = init?.detail;
      }
    },
  );
}

function recipeFixture(
  partial: Partial<Recipe> & Pick<Recipe, "id" | "name">,
): Recipe {
  return {
    ingredients: [
      {
        id: "i1",
        name: "玉ねぎ",
        quantity: 1,
        unit: "個",
        note: "",
        ingredientType: "normal",
      },
      {
        id: "i2",
        name: "豚肉",
        quantity: 200,
        unit: "g",
        note: "",
        ingredientType: "normal",
      },
    ],
    steps: [{ id: "s1", order: 1, text: "炒める" }],
    category: "和食",
    course: "主菜",
    tags: [],
    servings: 2,
    cookingTimeMinutes: 25,
    calories: null,
    protein: null,
    fat: null,
    carbohydrates: null,
    salt: null,
    vegetables: null,
    proteinType: "豚",
    season: null,
    difficulty: null,
    favoriteScore: null,
    healthyScore: null,
    isSample: false,
    averageRating: null,
    cookCount: 0,
    lastCookedAt: null,
    familyFavoriteScore: null,
    improvementCount: 0,
    favoriteByUsers: [],
    wantAgainYes: 0,
    wantAgainNo: 0,
    parentRecipeId: null,
    isFamilyVariant: false,
    variantSummary: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function baseScoreCtx(overrides: Partial<ScoreContext> = {}): ScoreContext {
  return {
    dayIndex: 0,
    usedRecipeIds: new Set(),
    previousMainIngredientKey: null,
    previousGenreKey: null,
    previousWasFish: null,
    previousWasMeat: null,
    weekHasFish: false,
    recentRecipeIds: new Set(),
    inventory: [],
    ...overrides,
  };
}

describe("料理フィードバック・我が家版学習", () => {
  beforeEach(() => {
    stubLocalStorage();
    replaceRecipes([]);
    replaceCookingHistory([]);
    replaceCookingFeedbacks([]);
    replaceRecipeVariants([]);
  });

  it("評価保存: CookingHistory と CookingFeedback を保存する", () => {
    const parent = recipeFixture({ id: "r-learn-1", name: "BONIQカレー" });
    replaceRecipes([parent]);

    const { historyId, feedback } = recordCookingWithFeedback({
      recipeId: parent.id,
      householdId: "local",
      createdBy: "member-wife",
      servings: 3,
      cookingTimeActual: 40,
      overallRating: 5,
      wantAgain: true,
      improvementTags: ["taste_bit_thick", "ing_onion_add"],
      memo: "次は玉ねぎ多め",
      memberRatings: [
        { memberId: "member-wife", memberName: "妻", rating: 5 },
        { memberId: "member-daughter", memberName: "娘", rating: 4 },
      ],
      tasteSalt: "thick",
      tasteSweet: "just",
      tasteSpicy: "not_spicy",
      texture: "soft",
      timeFeeling: "just",
    });

    const histories = loadCookingHistory();
    expect(histories).toHaveLength(1);
    expect(histories[0]?.id).toBe(historyId);
    expect(histories[0]?.recipeId).toBe(parent.id);
    expect(histories[0]?.servings).toBe(3);
    expect(histories[0]?.cookingTimeActual).toBe(40);
    expect(histories[0]?.createdBy).toBe("member-wife");
    expect(histories[0]?.memo).toBe("次は玉ねぎ多め");
    expect(histories[0]?.wantAgain).toBe(true);
    expect(histories[0]?.improvementTags).toContain("taste_bit_thick");

    const feedbacks = getFeedbacksForRecipe(parent.id);
    expect(feedbacks).toHaveLength(1);
    expect(feedbacks[0]?.id).toBe(feedback.id);
    expect(feedbacks[0]?.overallRating).toBe(5);
    expect(feedbacks[0]?.memberRatings).toHaveLength(2);
    expect(feedbacks[0]?.tasteSalt).toBe("thick");
  });

  it("平均評価・作った回数・改善履歴を履歴から集計する", () => {
    const parent = recipeFixture({ id: "r-learn-2", name: "肉じゃが" });
    replaceRecipes([parent]);

    recordCookingWithFeedback({
      recipeId: parent.id,
      householdId: "local",
      createdBy: "me",
      servings: 2,
      cookingTimeActual: 30,
      overallRating: 4,
      wantAgain: true,
      improvementTags: ["ing_onion_double", "sweet_half_sugar"],
      memo: "",
      memberRatings: [{ memberId: "me", memberName: "自分", rating: 5 }],
    });
    recordCookingWithFeedback({
      recipeId: parent.id,
      householdId: "local",
      createdBy: "me",
      servings: 2,
      cookingTimeActual: 28,
      overallRating: 5,
      wantAgain: true,
      improvementTags: ["other_easy"],
      memo: "良かった",
    });

    const stats = computeRecipeLearningStats(parent.id);
    expect(stats.cookCount).toBe(2);
    expect(stats.lastCookedAt).not.toBeNull();
    expect(stats.improvementCount).toBe(3);
    // overall 4, member 5, overall 5 → (4+5+5)/3 = 4.7
    expect(stats.averageRating).toBe(4.7);
    expect(stats.wantAgainYes).toBe(2);
    expect(stats.favoriteByUsers).toContain("me");

    refreshRecipeLearningStats(parent.id);
    const updated = getRecipeById(parent.id);
    expect(updated?.cookCount).toBe(2);
    expect(updated?.averageRating).toBe(4.7);
    expect(updated?.improvementCount).toBe(3);
    expect(updated?.familyFavoriteScore).not.toBeNull();
  });

  it("RecipeVariant 作成: 親は変更せず我が家版を作る", () => {
    const parent = recipeFixture({ id: "r-parent", name: "BONIQ煮込み" });
    replaceRecipes([parent]);

    recordCookingWithFeedback({
      recipeId: parent.id,
      householdId: "local",
      createdBy: null,
      servings: 2,
      cookingTimeActual: 45,
      overallRating: 4,
      wantAgain: true,
      improvementTags: ["ing_pork_koma", "sweet_half_sugar", "ing_onion_double"],
      memo: "豚こま・砂糖半分・玉ねぎ2倍",
    });

    expect(canCreateFamilyVariant(parent.id)).toBe(true);
    const variant = createFamilyRecipeVariant({
      parentRecipeId: parent.id,
      householdId: "local",
    });
    expect(variant).not.toBeNull();
    expect(variant?.parentRecipeId).toBe(parent.id);
    expect(variant?.title).toContain("我が家版");
    expect(variant?.changes.some((c) => c.includes("豚こま"))).toBe(true);

    const parentAfter = getRecipeById(parent.id);
    expect(parentAfter?.name).toBe("BONIQ煮込み");
    expect(parentAfter?.isFamilyVariant).toBe(false);

    const variantRecipe = getRecipeById(variant!.variantRecipeId);
    expect(variantRecipe?.isFamilyVariant).toBe(true);
    expect(variantRecipe?.parentRecipeId).toBe(parent.id);
    expect(variantRecipe?.tags).toContain("我が家版");
    expect(getVariantsForParent(parent.id)).toHaveLength(1);
  });

  it("週間献立採点: 高評価・家族人気・久しぶりは加点、低評価・また作るNoは減点", () => {
    const high = recipeFixture({
      id: "high",
      name: "高評価",
      course: "主菜",
      cookingTimeMinutes: 20,
      averageRating: 4.8,
      familyFavoriteScore: 4.5,
      lastCookedAt: "2026-01-01T00:00:00.000Z",
      cookCount: 5,
      wantAgainYes: 4,
      wantAgainNo: 0,
    });
    const low = recipeFixture({
      id: "low",
      name: "低評価",
      course: "主菜",
      cookingTimeMinutes: 20,
      averageRating: 1.5,
      familyFavoriteScore: 1.2,
      lastCookedAt: new Date().toISOString(),
      cookCount: 4,
      wantAgainYes: 0,
      wantAgainNo: 3,
    });

    const highScore = scoreRecipeForSlot(high, baseScoreCtx()).score;
    const lowScore = scoreRecipeForSlot(low, baseScoreCtx()).score;
    expect(highScore).toBeGreaterThan(lowScore);

    const highReasons = scoreRecipeForSlot(high, baseScoreCtx()).reasons.map(
      (r) => r.detail,
    );
    expect(
      highReasons.some(
        (d) => d.includes("家族人気") || d.includes("高評価") || d.includes("久しぶり"),
      ),
    ).toBe(true);

    const lowReasons = scoreRecipeForSlot(low, baseScoreCtx()).reasons.map(
      (r) => r.detail,
    );
    expect(
      lowReasons.some(
        (d) => d.includes("低評価") || d.includes("また作る"),
      ),
    ).toBe(true);
  });

  it("Repository 経由で History / Feedback / Variant を保存できる", async () => {
    const historyRepo = createLocalCookingHistoryRepository();
    const feedbackRepo = createLocalCookingFeedbackRepository();
    const variantRepo = createLocalRecipeVariantRepository();

    const history = await historyRepo.add({
      householdId: "local",
      recipeId: "r-repo",
      cookedByMemberId: "u1",
      difficultyFeedback: null,
      durationMinutes: 20,
      successRating: 4,
      notes: "repo",
      servings: 2,
      cookingTimeActual: 20,
      createdBy: "u1",
      memo: "repo",
      wantAgain: true,
      improvementTags: ["other_easy"],
    });
    expect((await historyRepo.list()).some((h) => h.id === history.id)).toBe(
      true,
    );

    const now = new Date().toISOString();
    const feedback = await feedbackRepo.save({
      id: "fb1",
      historyId: history.id,
      recipeId: "r-repo",
      householdId: "local",
      cookedAt: now,
      createdBy: "u1",
      overallRating: 4,
      tasteSalt: "just",
      tasteSweet: "just",
      tasteSpicy: "just",
      texture: "just",
      timeFeeling: "just",
      wantAgain: true,
      cookingTimeActualMinutes: 20,
      servingsActual: 2,
      improvementTags: ["other_easy"],
      memberRatings: [{ memberId: "u1", rating: 4 }],
      adjustments: [],
      seasoningAdjustments: [],
      photoDataUrl: null,
      memo: "ok",
      createdAt: now,
      updatedAt: now,
    });
    expect((await feedbackRepo.listByRecipe("r-repo"))[0]?.id).toBe(
      feedback.id,
    );

    const variant = await variantRepo.save({
      id: "v1",
      parentRecipeId: "r-repo",
      variantRecipeId: "r-variant",
      title: "我が家版",
      summary: "簡単",
      changes: ["簡単"],
      sourceHistoryIds: [history.id],
      sourceFeedbackIds: [feedback.id],
      householdId: "local",
      createdAt: now,
      updatedAt: now,
    });
    expect((await variantRepo.listByParent("r-repo"))[0]?.id).toBe(variant.id);
    expect(loadCookingFeedbacks().length).toBe(1);
    expect(loadRecipeVariants().length).toBe(1);
    expect(loadRecipes().length).toBe(0);
  });

  it("改善履歴・また作る率・写真なしでも保存できる", () => {
    const parent = recipeFixture({ id: "r-adj", name: "肉じゃが" });
    replaceRecipes([parent]);
    const { feedback } = recordCookingWithFeedback({
      recipeId: parent.id,
      householdId: "local",
      createdBy: "me",
      servings: 2,
      cookingTimeActual: 30,
      overallRating: 5,
      wantAgain: true,
      improvementTags: ["ing_onion_more", "sweet_half_sugar"],
      memo: "",
      adjustments: [
        {
          ingredientName: "玉ねぎ",
          adjustmentType: "increase",
          beforeValue: "1個",
          afterValue: "1.5個",
          memo: null,
        },
      ],
      seasoningAdjustments: [
        {
          seasoning: "砂糖",
          beforeAmount: "大さじ2",
          afterAmount: "大さじ1",
          reason: "少し甘かった",
        },
      ],
      photoDataUrl: null,
      memberRatings: [
        { memberId: "wife", memberName: "妻", rating: 5 },
        { memberId: "me", memberName: "自分", rating: 5 },
      ],
    });
    expect(feedback.photoDataUrl).toBeNull();
    expect(feedback.adjustments[0]?.afterValue).toBe("1.5個");
    expect(feedback.seasoningAdjustments[0]?.seasoning).toBe("砂糖");
    const stats = computeRecipeLearningStats(parent.id);
    expect(stats.wantAgainRate).toBe(1);
    expect(stats.recentImprovementLabels.length).toBeGreaterThan(0);
    expect(stats.popularMemberIds).toContain("wife");
  });

  it("家族同期Repository: Feedback の replaceAll 相当が動く", () => {
    const now = new Date().toISOString();
    replaceCookingFeedbacks([
      {
        id: "sync-1",
        historyId: "h-sync",
        recipeId: "r-sync",
        householdId: "local",
        cookedAt: now,
        createdBy: null,
        overallRating: 4,
        tasteSalt: null,
        tasteSweet: null,
        tasteSpicy: null,
        texture: null,
        timeFeeling: null,
        wantAgain: true,
        cookingTimeActualMinutes: null,
        servingsActual: null,
        improvementTags: ["want_again"],
        memberRatings: [],
        adjustments: [],
        seasoningAdjustments: [],
        photoDataUrl: null,
        memo: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    expect(loadCookingFeedbacks()).toHaveLength(1);
    replaceCookingFeedbacks([]);
    expect(loadCookingFeedbacks()).toHaveLength(0);
  });

  it("MockProvider は OpenAI を呼ばず改善案を返す", async () => {
    const provider = new MockRecipeImprovementProvider();
    const parent = recipeFixture({ id: "r-ai", name: "テスト鍋" });
    const suggestion = await provider.suggestVariant({
      parent,
      feedbacks: [
        {
          id: "f1",
          historyId: "h1",
          recipeId: parent.id,
          householdId: "local",
          cookedAt: "2026-01-01T00:00:00.000Z",
          createdBy: null,
          overallRating: 4,
          tasteSalt: "thick",
          tasteSweet: null,
          tasteSpicy: null,
          texture: null,
          timeFeeling: null,
          wantAgain: true,
          cookingTimeActualMinutes: null,
          servingsActual: null,
          improvementTags: ["taste_bit_thick", "ing_onion_add", "salt_reduce"],
          memberRatings: [],
          adjustments: [],
          seasoningAdjustments: [],
          photoDataUrl: null,
          memo: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      existingVariants: [],
    });
    expect(suggestion.summary).toContain("我が家版");
    expect(suggestion.proposedChanges.length).toBeGreaterThan(0);
    expect(suggestion.confidence).toBe("high");

    const noop = new NoOpRecipeImprovementProvider();
    const empty = await noop.suggestVariant({
      parent,
      feedbacks: [],
      existingVariants: [],
    });
    expect(empty.proposedChanges).toEqual([]);
  });
});
