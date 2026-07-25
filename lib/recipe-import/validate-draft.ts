/**
 * AI / 取り込み結果のサーバー側検証
 */
import { aiRecipeExtractionSchema, type AIRecipeExtractionResult } from "@/lib/recipe-import/ai-schema";
import { summarizeZodIssues } from "@/lib/recipe-import/ai-debug-log";
import type {
  ImportCuisine,
  ImportMealRole,
  ImportMealStyle,
  ImportStapleType,
  RecipeDraft,
  RecipeDraftIngredient,
  RecipeDraftStep,
} from "@/types/recipe-import";

const LIMITS = {
  ingredients: 100,
  steps: 50,
  title: 200,
  ingredientText: 500,
  stepText: 2000,
  servingsMax: 100,
  timeMax: 24 * 60,
};

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function clampText(text: string, max: number): string {
  const cleaned = stripHtml(text);
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

function isQualitativeZero(quantity: number | null, quantityText: string | null): boolean {
  if (quantity !== 0) return false;
  return /少々|適量|ひとつまみ|お好み|適当|少し/.test(quantityText ?? "");
}

export type ValidatedExtraction = {
  ok: boolean;
  draft: RecipeDraft | null;
  documentType: AIRecipeExtractionResult["documentType"] | null;
  errors: string[];
  warnings: string[];
  schemaDebug: {
    zodErrorFull: string | null;
    failedFields: string[];
    enumMismatches: string[];
    missingRequired: string[];
    jsonParseError: string | null;
  };
};

export function validateAiExtraction(
  raw: unknown,
  sourceUrl: string,
): ValidatedExtraction {
  const errors: string[] = [];
  const warnings: string[] = [];
  const emptySchema = {
    zodErrorFull: null as string | null,
    failedFields: [] as string[],
    enumMismatches: [] as string[],
    missingRequired: [] as string[],
    jsonParseError: null as string | null,
  };

  if (raw == null) {
    return {
      ok: false,
      draft: null,
      documentType: null,
      errors: ["AI応答が空です"],
      warnings: [],
      schemaDebug: {
        ...emptySchema,
        jsonParseError: "raw is null/undefined",
      },
    };
  }

  const parsed = aiRecipeExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    const summarized = summarizeZodIssues(
      parsed.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
      })),
    );
    return {
      ok: false,
      draft: null,
      documentType: null,
      errors: [
        "AI応答の形式が不正です",
        ...parsed.error.issues.slice(0, 8).map((i) => {
          const path = i.path.map(String).join(".") || "(root)";
          return `${path}: ${i.message}`;
        }),
      ],
      warnings: [],
      schemaDebug: {
        ...summarized,
        jsonParseError: null,
      },
    };
  }

  const data = parsed.data;
  if (data.documentType === "not_recipe") {
    return {
      ok: false,
      draft: null,
      documentType: "not_recipe",
      errors: ["このページはレシピとして読み取れませんでした"],
      warnings: data.warnings,
      schemaDebug: emptySchema,
    };
  }

  const title = data.title ? clampText(data.title, LIMITS.title) : null;
  if (title && title.length > LIMITS.title) {
    errors.push("タイトルが長すぎます");
  }

  if (data.servings != null && (data.servings < 0 || data.servings > LIMITS.servingsMax)) {
    warnings.push("人数が範囲外のため無視しました");
    data.servings = null;
  }

  for (const key of ["prepTimeMinutes", "cookTimeMinutes", "totalTimeMinutes"] as const) {
    const value = data[key];
    if (value != null && (value < 0 || value > LIMITS.timeMax)) {
      warnings.push(`${key} が範囲外のため無視しました`);
      data[key] = null;
    }
  }

  const ingredients: RecipeDraftIngredient[] = [];
  const seenIng = new Set<string>();
  for (const item of data.ingredients.slice(0, LIMITS.ingredients)) {
    const name = clampText(item.name || item.rawText, LIMITS.ingredientText);
    const rawText = clampText(item.rawText || name, LIMITS.ingredientText);
    if (!name) continue;
    if (/^\d+\s*人[分前]$/.test(name) || /人分|人前/.test(name) && name.length < 10) {
      continue;
    }
    let quantity = item.quantity;
    if (quantity != null && quantity < 0) {
      warnings.push(`負の数量を無視: ${name}`);
      quantity = null;
    }
    if (isQualitativeZero(quantity, item.quantityText)) {
      quantity = null;
    }
    const key = `${item.groupName ?? ""}|${name}|${quantity ?? ""}|${item.unit ?? ""}`;
    if (seenIng.has(key)) continue;
    seenIng.add(key);
    ingredients.push({
      rawText,
      name,
      groupName: item.groupName ? clampText(item.groupName, 80) : null,
      alias: item.alternativeNames?.[0]
        ? clampText(item.alternativeNames[0], 80)
        : null,
      quantity,
      quantityText: item.quantityText ? clampText(item.quantityText, 80) : null,
      unit: item.unit ? clampText(item.unit, 40) : null,
      note: item.note ? clampText(item.note, 200) : null,
      confidence: item.confidence,
    });
  }

  const steps: RecipeDraftStep[] = [];
  const seenStep = new Set<string>();
  let order = 1;
  for (const step of data.steps.slice(0, LIMITS.steps)) {
    const text = clampText(step.text, LIMITS.stepText);
    if (!text || /^STEP\s*\d+$/i.test(text)) continue;
    if (/関連記事|おすすめ|ランキング|広告/.test(text) && text.length < 40) continue;
    if (seenStep.has(text)) continue;
    seenStep.add(text);
    steps.push({
      order: order++,
      text,
      sectionName: step.sectionName ?? null,
      temperatureCelsius:
        step.temperatureCelsius != null && step.temperatureCelsius >= 0
          ? step.temperatureCelsius
          : null,
      durationMinutes:
        step.durationMinutes != null && step.durationMinutes >= 0
          ? step.durationMinutes
          : null,
      confidence: step.confidence,
    });
  }

  if (data.ingredients.length > LIMITS.ingredients) {
    warnings.push(`材料を${LIMITS.ingredients}件に制限しました`);
  }
  if (data.steps.length > LIMITS.steps) {
    warnings.push(`手順を${LIMITS.steps}件に制限しました`);
  }

  const mealRole =
    data.mealRole === "unknown" ? null : (data.mealRole as ImportMealRole);

  const draft: RecipeDraft = {
    title: title || undefined,
    description: data.description ? clampText(data.description, 1000) : undefined,
    servings: data.servings,
    servingsText: data.servingsText ? clampText(data.servingsText, 40) : null,
    prepTimeMinutes: data.prepTimeMinutes,
    cookTimeMinutes: data.cookTimeMinutes,
    totalTimeMinutes: data.totalTimeMinutes,
    ingredients,
    steps,
    cuisine: data.cuisine as ImportCuisine,
    mealRole,
    stapleType: data.stapleType as ImportStapleType,
    mealStyle: data.mealStyle as ImportMealStyle,
    tags: data.tags.slice(0, 20).map((t) => clampText(t, 40)),
    sourceTitle: data.sourceTitle ? clampText(data.sourceTitle, 200) : title,
    sourceAuthor: data.sourceAuthor ? clampText(data.sourceAuthor, 100) : null,
    sourceUrl, // 入力URL固定
    importMethod: "url",
    importedAt: new Date().toISOString(),
    importSource: "ai_html",
    documentType: data.documentType,
    warnings: [...data.warnings, ...warnings],
    confidence:
      ingredients.length >= 2 && steps.length >= 1 ? "medium" : "low",
    fieldSources: {
      title: "ai_html",
      ingredients: "ai_html",
      steps: "ai_html",
      servings: data.servings != null ? "ai_html" : undefined,
    },
  };

  const ok =
    Boolean(draft.title) && (ingredients.length >= 1 || steps.length >= 1);

  if (!ok) {
    errors.push("タイトルと材料または作り方が不足しています");
  }

  return {
    ok,
    draft: ok ? draft : draft.title || ingredients.length || steps.length ? draft : null,
    documentType: data.documentType,
    errors,
    warnings: draft.warnings ?? [],
    schemaDebug: emptySchema,
  };
}

/** ルール/JSON-LD下書きの軽量サニタイズ */
export function sanitizeRecipeDraft(
  draft: RecipeDraft,
  sourceUrl: string,
): RecipeDraft {
  return {
    ...draft,
    title: draft.title ? clampText(draft.title, LIMITS.title) : draft.title,
    sourceUrl,
    ingredients: draft.ingredients.slice(0, LIMITS.ingredients).map((item) => ({
      ...item,
      name: clampText(item.name, LIMITS.ingredientText),
      rawText: clampText(item.rawText, LIMITS.ingredientText),
      quantity:
        item.quantity != null && item.quantity < 0 ? null : item.quantity,
    })),
    steps: draft.steps
      .slice(0, LIMITS.steps)
      .map((step, index) => ({
        ...step,
        order: index + 1,
        text: clampText(step.text, LIMITS.stepText),
      })),
  };
}
