/**
 * 献立選定理由の構造化ビルダー。
 * LLMは使わず、スコア理由＋文脈から短い箇条書きを組み立てる。
 */
import { MEAL_PLAN_TAG_DEFS, type MealPlanTagId } from "@/types/meal-plan-tags";
import type {
  MealDecisionExplanation,
  MealDecisionStructured,
  MealReasonType,
  MealSelectionReason,
} from "@/types/meal-decision-explanation";
import type { SelectionReason } from "@/types/weekly-meal-plan";
import type { Recipe } from "@/types/recipe";
import type { FamilyMemberProfile } from "@/types/family-member-profile";
import type { HealthGoal } from "@/types/meal-preferences";
import { WEEKDAY_LABELS, parseDate } from "@/lib/date";

const SHORT_MAX = 22;

export type ExplainContext = {
  recipe: Recipe;
  score: number;
  scoredReasons: SelectionReason[];
  dayIndex: number;
  date?: string;
  planTags?: readonly MealPlanTagId[];
  inventoryMatched?: string[];
  leftoverMatched?: string[];
  recurringMatched?: string[];
  cookMember?: { id: string; displayName: string } | null;
  familyProfiles?: FamilyMemberProfile[];
  householdHealthGoal?: HealthGoal | string | null;
  defaultMealServings?: number | null;
};

function shorten(text: string, max = SHORT_MAX): string {
  const t = text.replace(/^・/, "").replace(/\s+/g, "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function scoreToStars(score: number): number {
  if (score >= 95) return 5;
  if (score >= 80) return 4;
  if (score >= 65) return 3;
  if (score >= 50) return 2;
  return 1;
}

function classifyDetail(detail: string): {
  type: MealReasonType;
  priority: number;
  weight: number;
  positive: boolean;
} {
  const d = detail;
  if (/冷蔵|余り|在庫|消費|使い切|ピーマン|キャベツ|玉ねぎ|じゃがいも|定期購入/.test(d)) {
    return { type: "inventory", priority: 95, weight: 12, positive: !/避け|減点/.test(d) };
  }
  if (/糖尿|血糖|健康|減塩希望|減塩の希望|インスリン/.test(d)) {
    return { type: "health", priority: 88, weight: 10, positive: !/避け|減点|控えめに$/.test(d) || /減塩|配慮/.test(d) };
  }
  if (/平日|分以内|時短|週末|担当|火曜|月曜|水曜|木曜|金曜/.test(d)) {
    return { type: "schedule", priority: 90, weight: 14, positive: !/長い|かかる/.test(d) };
  }
  if (/レビュー|評価|好評|最近作|久しぶり|家族/.test(d)) {
    return { type: "review", priority: 80, weight: 9, positive: !/避け|減点|つい最近/.test(d) };
  }
  if (/野菜不足|たんぱく|塩分|栄養|糖質|カロリー/.test(d)) {
    return { type: "nutrition", priority: 78, weight: 8, positive: !/過剰|多いため減/.test(d) };
  }
  if (/減量|タグ|野菜多め|魚多め|肉多め|時短希望|節約/.test(d)) {
    return { type: "tags", priority: 82, weight: 10, positive: !/避け|減点/.test(d) };
  }
  if (/この家庭|担当の日|成功率|好評|学習|好みの食材/.test(d)) {
    return { type: "profile", priority: 86, weight: 9, positive: !/低い|避け|変更され/.test(d) };
  }
  if (/好き|苦手|好み|プロフィール|さん/.test(d)) {
    return { type: "profile", priority: 85, weight: 9, positive: !/苦手|避け/.test(d) };
  }
  if (/魚|肉|ジャンル|主食材|重複|バランス|副菜|主菜|汁物|洋風|和食|組み合わせ/.test(d)) {
    return { type: "balance", priority: 75, weight: 8, positive: !/重複|避け|減点/.test(d) };
  }
  if (/家庭|人数|方針/.test(d)) {
    return { type: "household", priority: 70, weight: 6, positive: true };
  }
  return {
    type: "other",
    priority: 40,
    weight: /減点|避け|長い/.test(d) ? -5 : 4,
    positive: !/減点|避け|長い|重複/.test(d),
  };
}

function pushUnique(
  list: MealDecisionExplanation[],
  item: MealDecisionExplanation,
): void {
  if (list.some((x) => x.message === item.message && x.reasonType === item.reasonType)) {
    return;
  }
  list.push(item);
}

function tagLabel(id: MealPlanTagId): string {
  return MEAL_PLAN_TAG_DEFS.find((t) => t.id === id)?.label ?? id;
}

/**
 * スコア結果と文脈から採用理由を構造化する。
 */
export function buildMealSelectionReason(
  input: ExplainContext,
): MealSelectionReason {
  const explanations: MealDecisionExplanation[] = [];
  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];
  const tagInfluence: string[] = [];
  const nutritionInfluence: string[] = [];
  const profileInfluence: string[] = [];
  const reviewInfluence: string[] = [];
  const inventoryInfluence: string[] = [];
  const structured: MealDecisionStructured = {};

  // スコア由来
  for (const reason of input.scoredReasons) {
    const meta = classifyDetail(reason.detail);
    const message = shorten(reason.detail);
    pushUnique(explanations, {
      reasonType: meta.type,
      priority: meta.priority,
      message,
      source: `score:${meta.type}`,
      weight: meta.weight,
      detail: reason.detail.length > SHORT_MAX ? reason.detail : undefined,
    });
    if (meta.positive) positiveFactors.push(message);
    else negativeFactors.push(message);

    if (meta.type === "inventory") inventoryInfluence.push(message);
    if (meta.type === "nutrition") nutritionInfluence.push(message);
    if (meta.type === "profile") profileInfluence.push(message);
    if (meta.type === "review") reviewInfluence.push(message);
    if (meta.type === "tags") tagInfluence.push(message);
  }

  // 余り・在庫の明示
  for (const name of input.leftoverMatched ?? []) {
    const message = shorten(`余り${name}を優先`);
    pushUnique(explanations, {
      reasonType: "inventory",
      priority: 96,
      message,
      source: `leftover:${name}`,
      weight: 14,
      detail: `余っている${name}を優先しました`,
    });
    inventoryInfluence.push(message);
    positiveFactors.push(message);
    if (!structured.inventory) structured.inventory = `${name}を消費`;
  }
  for (const name of input.recurringMatched ?? []) {
    const message = shorten(`定期購入${name}を活用`);
    pushUnique(explanations, {
      reasonType: "inventory",
      priority: 95,
      message,
      source: `recurring:${name}`,
      weight: 13,
      detail: `定期購入で届く${name}を優先しました`,
    });
    inventoryInfluence.push(message);
    positiveFactors.push(message);
    if (!structured.inventory) structured.inventory = `${name}を活用`;
  }
  for (const name of (input.inventoryMatched ?? []).slice(0, 2)) {
    const message = shorten(`冷蔵の${name}を活用`);
    pushUnique(explanations, {
      reasonType: "inventory",
      priority: 94,
      message,
      source: `inventory:${name}`,
      weight: 12,
      detail: `冷蔵庫の${name}を使えます`,
    });
    inventoryInfluence.push(message);
    if (!structured.inventory) structured.inventory = `${name}を消費`;
  }

  // 曜日・担当
  if (input.date) {
    const weekday = WEEKDAY_LABELS[(parseDate(input.date).getDay() + 6) % 7];
    const time = input.recipe.cookingTimeMinutes;
    if (input.dayIndex <= 4 && time != null && time <= 30) {
      const message = shorten(`${weekday}曜は${time}分以内`);
      pushUnique(explanations, {
        reasonType: "schedule",
        priority: 91,
        message,
        source: `schedule:${weekday}`,
        weight: 12,
        detail: `今日は${weekday}曜日なので${time}分以内で作れる料理です`,
      });
      if (!structured.schedule) structured.schedule = `${weekday}曜なので時短`;
    }
  }

  if (input.cookMember) {
    const name = input.cookMember.displayName;
    const profile = input.familyProfiles?.find(
      (p) => p.id === input.cookMember!.id,
    );
    const easy =
      input.recipe.cookingTimeMinutes != null &&
      input.recipe.cookingTimeMinutes <= 25;
    const message = easy
      ? shorten(`${name}担当で簡単`)
      : shorten(`${name}さんの担当日`);
    pushUnique(explanations, {
      reasonType: "profile",
      priority: 92,
      message,
      source: `cook:${input.cookMember.id}`,
      weight: 11,
      detail: easy
        ? `${name}さんが担当なので簡単な料理です`
        : `${name}さんの料理担当日です`,
    });
    profileInfluence.push(message);
    structured.profile = message;

    if (profile?.healthFlags.includes("diabetes_care")) {
      const msg = shorten(`${name}の糖尿病配慮`);
      pushUnique(explanations, {
        reasonType: "health",
        priority: 89,
        message: msg,
        source: `profile-health:${profile.id}`,
        weight: 10,
        detail: `${name}さんの糖尿病配慮を考慮しています`,
      });
      structured.health = msg;
      profileInfluence.push(msg);
    }
  } else if (input.familyProfiles) {
    const diabetesMember = input.familyProfiles.find(
      (p) => p.isActive && p.healthFlags.includes("diabetes_care"),
    );
    if (diabetesMember) {
      const msg = shorten(`${diabetesMember.displayName}の糖尿病配慮`);
      pushUnique(explanations, {
        reasonType: "health",
        priority: 87,
        message: msg,
        source: `profile-health:${diabetesMember.id}`,
        weight: 9,
        detail: `${diabetesMember.displayName}さんの糖尿病配慮を考慮しています`,
      });
      structured.health = msg;
      profileInfluence.push(msg);
    }
  }

  // タグ影響
  if (input.planTags && input.planTags.length > 0) {
    const labels = input.planTags.map(tagLabel);
    structured.tags = labels;
    for (const tag of input.planTags.slice(0, 3)) {
      const label = tagLabel(tag);
      let message = shorten(`${label}を考慮`);
      let detail = `${label}タグを考慮しています`;
      if (tag === "weight_loss" && /揚げ|フライ|天ぷら/.test(input.recipe.name)) {
        message = shorten("減量で揚げ物回避");
        detail = "減量設定のため揚げ物を避けました";
      }
      if (tag === "quick" && (input.recipe.cookingTimeMinutes ?? 99) <= 20) {
        message = shorten("時短タグで短時間");
        detail = "時短タグのため短い調理時間を優先しました";
      }
      if (tag === "more_fish") {
        message = shorten("魚多めタグを優先");
      }
      pushUnique(explanations, {
        reasonType: "tags",
        priority: 83,
        message,
        source: `tag:${tag}`,
        weight: 8,
        detail,
      });
      tagInfluence.push(message);
    }
  }

  // 家庭方針
  if (input.householdHealthGoal && input.householdHealthGoal !== "通常") {
    const goal = String(input.householdHealthGoal);
    const message = shorten(`家庭方針（${goal}）`);
    pushUnique(explanations, {
      reasonType: "household",
      priority: 72,
      message,
      source: `household:${goal}`,
      weight: 7,
      detail: `家庭の健康方針（${goal}）を考慮しています`,
    });
    structured.household = `健康方針（${goal}）`;
  }

  // レビュー明示
  if (
    input.recipe.averageRating != null &&
    input.recipe.averageRating >= 4.2
  ) {
    const rating = input.recipe.averageRating.toFixed(1);
    const message = shorten(`レビュー${rating}`);
    pushUnique(explanations, {
      reasonType: "review",
      priority: 81,
      message,
      source: "review:rating",
      weight: 8,
      detail: `家族評価が高い料理です（${rating}）`,
    });
    structured.review = `家族評価${rating}`;
    reviewInfluence.push(message);
  }

  // structured の穴埋め（既存 explanations から）
  for (const ex of explanations) {
    if (ex.reasonType === "health" && !structured.health) {
      structured.health = ex.message;
    }
    if (ex.reasonType === "schedule" && !structured.schedule) {
      structured.schedule = ex.message;
    }
    if (ex.reasonType === "review" && !structured.review) {
      structured.review = ex.message;
    }
    if (ex.reasonType === "balance" && !structured.balance) {
      structured.balance = ex.message;
    }
    if (ex.reasonType === "nutrition" && !structured.nutrition) {
      structured.nutrition = ex.message;
    }
    if (ex.reasonType === "profile" && !structured.profile) {
      structured.profile = ex.message;
    }
    if (ex.reasonType === "inventory" && !structured.inventory) {
      structured.inventory = ex.message;
    }
  }

  explanations.sort((a, b) => b.priority - a.priority || b.weight - a.weight);

  const uniq = (items: string[]) => [...new Set(items)].slice(0, 6);

  return {
    score: input.score,
    stars: scoreToStars(input.score),
    reasons: explanations.slice(0, 10),
    positiveFactors: uniq(positiveFactors),
    negativeFactors: uniq(negativeFactors),
    tagInfluence: uniq(tagInfluence),
    nutritionInfluence: uniq(nutritionInfluence),
    profileInfluence: uniq(profileInfluence),
    reviewInfluence: uniq(reviewInfluence),
    inventoryInfluence: uniq(inventoryInfluence),
    structured,
  };
}

/** 日全体の理由（重複除去・優先順） */
export function aggregateDaySelectionReasons(
  selections: MealSelectionReason[],
  fallbackStrings: string[] = [],
): { messages: string[]; details: MealDecisionExplanation[] } {
  const map = new Map<string, MealDecisionExplanation>();
  for (const selection of selections) {
    for (const reason of selection.reasons) {
      const key = `${reason.reasonType}:${reason.message}`;
      const prev = map.get(key);
      if (!prev || reason.priority > prev.priority) {
        map.set(key, reason);
      }
    }
  }
  if (map.size === 0) {
    for (const text of fallbackStrings) {
      const message = shorten(text);
      map.set(`other:${message}`, {
        reasonType: "other",
        priority: 30,
        message,
        source: "legacy",
        weight: 1,
        detail: text,
      });
    }
  }
  const details = [...map.values()].sort(
    (a, b) => b.priority - a.priority,
  );
  return {
    messages: details.map((d) => d.message),
    details,
  };
}

/** UI表示用（短い箇条書き＋詳細） */
export function formatReasonsForUi(
  selection: MealSelectionReason | null | undefined,
  options?: { limit?: number },
): { short: string[]; more: string[] } {
  const limit = options?.limit ?? 4;
  if (!selection) return { short: [], more: [] };
  const all = selection.reasons.map((r) => r.detail ?? r.message);
  return {
    short: selection.reasons.slice(0, limit).map((r) => r.message),
    more: all.slice(limit),
  };
}

/** 旧 string[] から最低限の MealSelectionReason を復元 */
export function selectionReasonFromLegacyStrings(
  reasons: string[],
  score = 60,
): MealSelectionReason {
  const explanations: MealDecisionExplanation[] = [];
  const structured: MealDecisionStructured = {};
  for (const detail of reasons) {
    const meta = classifyDetail(detail);
    const message = shorten(detail);
    explanations.push({
      reasonType: meta.type,
      priority: meta.priority,
      message,
      source: `legacy:${meta.type}`,
      weight: meta.weight,
      detail: detail.length > SHORT_MAX ? detail : undefined,
    });
    if (meta.type === "inventory" && !structured.inventory) {
      structured.inventory = message;
    }
    if (meta.type === "health" && !structured.health) {
      structured.health = message;
    }
    if (meta.type === "schedule" && !structured.schedule) {
      structured.schedule = message;
    }
    if (meta.type === "review" && !structured.review) {
      structured.review = message;
    }
    if (meta.type === "balance" && !structured.balance) {
      structured.balance = message;
    }
    if (meta.type === "nutrition" && !structured.nutrition) {
      structured.nutrition = message;
    }
  }
  explanations.sort((a, b) => b.priority - a.priority);
  return {
    score,
    stars: scoreToStars(score),
    reasons: explanations.slice(0, 10),
    positiveFactors: explanations
      .filter((e) => e.weight >= 0)
      .map((e) => e.message)
      .slice(0, 6),
    negativeFactors: explanations
      .filter((e) => e.weight < 0)
      .map((e) => e.message)
      .slice(0, 6),
    tagInfluence: [],
    nutritionInfluence: explanations
      .filter((e) => e.reasonType === "nutrition")
      .map((e) => e.message),
    profileInfluence: [],
    reviewInfluence: explanations
      .filter((e) => e.reasonType === "review")
      .map((e) => e.message),
    inventoryInfluence: explanations
      .filter((e) => e.reasonType === "inventory")
      .map((e) => e.message),
    structured,
  };
}
