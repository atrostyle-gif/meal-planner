/**
 * 週間献立AI Provider（将来拡張用）。
 * v1 の自動編成はルールベースのみ。テストでは実APIを呼ばない。
 */
import type { Recipe } from "@/types/recipe";
import type { WeeklyMealPlan } from "@/types/weekly-meal-plan";

export type WeeklyPlanAiSuggestion = {
  notes: string[];
  preferredRecipeIds: string[];
};

export type WeeklyPlanAiProvider = {
  /**
   * ルールベース結果をAIで改善する場合のフック。
   * v1 では呼ばれない想定。
   */
  suggestImprovements(input: {
    plan: WeeklyMealPlan;
    recipes: Recipe[];
  }): Promise<WeeklyPlanAiSuggestion>;
};

/** 何もしない実装（本番デフォルト） */
export class NoOpWeeklyPlanAiProvider implements WeeklyPlanAiProvider {
  async suggestImprovements(): Promise<WeeklyPlanAiSuggestion> {
    return { notes: [], preferredRecipeIds: [] };
  }
}

/** テスト用モック（実API非依存） */
export class MockWeeklyPlanAiProvider implements WeeklyPlanAiProvider {
  constructor(
    private readonly response: WeeklyPlanAiSuggestion = {
      notes: ["mock"],
      preferredRecipeIds: [],
    },
  ) {}

  async suggestImprovements(): Promise<WeeklyPlanAiSuggestion> {
    return this.response;
  }
}

/**
 * OpenAI を使う実装のプレースホルダ。
 * v1 では自動編成パイプラインから呼び出さない。
 */
export class OpenAiWeeklyPlanAiProvider implements WeeklyPlanAiProvider {
  async suggestImprovements(): Promise<WeeklyPlanAiSuggestion> {
    throw new Error(
      "OpenAI による週間献立改善はまだ有効化されていません（ルールベースのみ）",
    );
  }
}

export function createDefaultWeeklyPlanAiProvider(): WeeklyPlanAiProvider {
  return new NoOpWeeklyPlanAiProvider();
}
