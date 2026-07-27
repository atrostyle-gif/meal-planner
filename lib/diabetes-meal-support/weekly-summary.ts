import type {
  DiabetesImprovementSuggestion,
  DiabetesMealSupportReport,
} from "@/types/diabetes-meal-support";
import { formatStars } from "@/lib/recipe-nutrition";

export type GradeMark = "◎" | "○" | "△" | "—";

export type AggregatedImprovement = {
  key: string;
  title: string;
  countLabel: string;
};

export type WeeklyHealthSummaryView = {
  stars: number;
  starsLabel: string;
  weightManagement: GradeMark;
  vegetables: GradeMark;
  protein: GradeMark;
  improvementCount: number;
  aggregatedImprovements: AggregatedImprovement[];
  nutritionMissingRecipeCount: number;
  weeklyCoverage: number;
};

function gradeFromRatio(ratio: number): GradeMark {
  if (!Number.isFinite(ratio)) return "—";
  if (ratio >= 0.8) return "◎";
  if (ratio >= 0.5) return "○";
  return "△";
}

/**
 * 同種の改善提案をまとめる（「野菜副菜を追加 あと2日」など）。
 */
export function aggregateImprovementSuggestions(
  suggestions: DiabetesImprovementSuggestion[],
): AggregatedImprovement[] {
  const groups = new Map<string, { title: string; dates: Set<string> }>();

  for (const suggestion of suggestions) {
    let key = "other";
    let title = suggestion.title;

    if (/野菜/.test(suggestion.title)) {
      key = "veg";
      title = "野菜副菜を追加";
    } else if (/魚/.test(suggestion.title)) {
      key = "fish";
      title = "魚料理を追加";
    } else if (/主食量|丼|玄米|雑穀/.test(suggestion.title)) {
      key = "staple";
      title = "主食量・主食の見直し";
    } else if (/甘い|飲料/.test(suggestion.title)) {
      key = "sweet";
      title = "甘い飲料・デザートの見直し";
    } else if (/栄養情報不足|判定不能|カバー/.test(suggestion.title + suggestion.detail)) {
      key = "nutrition-missing";
      title = "栄養情報不足";
    }

    const current = groups.get(key) ?? { title, dates: new Set<string>() };
    if (suggestion.date) {
      current.dates.add(suggestion.date);
    } else {
      current.dates.add(suggestion.id);
    }
    groups.set(key, current);
  }

  return [...groups.entries()].map(([key, value]) => {
    const count = value.dates.size;
    let countLabel = `${count}件`;
    if (key === "veg" || key === "fish" || key === "staple" || key === "sweet") {
      countLabel = `あと${count}日`;
    } else if (key === "nutrition-missing") {
      countLabel = `${count}レシピ`;
    }
    return { key, title: value.title, countLabel };
  });
}

/** 週間の健康・体重管理サマリー（カード表示用） */
export function buildWeeklyHealthSummaryView(
  report: DiabetesMealSupportReport,
): WeeklyHealthSummaryView {
  const days = report.mealChecks.length || 1;
  const knownMeals = report.mealChecks.filter(
    (meal) => meal.status !== "unknown" && meal.status !== "no_target",
  );
  const inRange = knownMeals.filter((meal) => meal.status === "in_range").length;
  const weightRatio =
    knownMeals.length === 0 ? NaN : inRange / knownMeals.length;

  const vegDays = report.mealChecks.filter((meal) => meal.hasVegetables).length;
  const vegRatio = vegDays / days;

  const proteinDays = report.dailyTotals.filter(
    (day) => day.proteinG != null && day.proteinG >= 40,
  ).length;
  const proteinRatio = proteinDays / days;

  const nutritionMissingRecipeCount = report.mealChecks.filter(
    (meal) => meal.nutritionCoverage < 40 || meal.status === "unknown",
  ).length;

  const aggregated = aggregateImprovementSuggestions(report.suggestions);
  if (nutritionMissingRecipeCount > 0) {
    const existing = aggregated.find((item) => item.key === "nutrition-missing");
    if (!existing) {
      aggregated.push({
        key: "nutrition-missing",
        title: "栄養情報不足",
        countLabel: `${nutritionMissingRecipeCount}日分`,
      });
    }
  }

  const weightMark = gradeFromRatio(weightRatio);
  const vegMark = gradeFromRatio(vegRatio);
  const proteinMark = gradeFromRatio(proteinRatio);

  const markScore = (mark: GradeMark): number => {
    if (mark === "◎") return 5;
    if (mark === "○") return 4;
    if (mark === "△") return 2;
    return 3;
  };
  const stars = Math.max(
    1,
    Math.min(
      5,
      Math.round(
        (markScore(weightMark) + markScore(vegMark) + markScore(proteinMark)) /
          3,
      ),
    ),
  );

  return {
    stars,
    starsLabel: formatStars(stars),
    weightManagement: weightMark,
    vegetables: vegMark,
    protein: proteinMark,
    improvementCount: aggregated.reduce((sum, item) => {
      const matched = item.countLabel.match(/(\d+)/);
      return sum + (matched ? Number(matched[1]) : 1);
    }, 0),
    aggregatedImprovements: aggregated.slice(0, 6),
    nutritionMissingRecipeCount,
    weeklyCoverage: report.weeklyTotals.nutritionCoverage,
  };
}
