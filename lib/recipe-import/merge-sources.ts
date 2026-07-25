/**
 * JSON-LD / AI / OG / ルール結果のフィールド単位統合
 */
import type { RecipeDraft } from "@/types/recipe-import";
import { sanitizeRecipeDraft } from "@/lib/recipe-import/validate-draft";

export type FieldSource =
  | "json_ld"
  | "ai_html"
  | "open_graph"
  | "html_rules"
  | "microdata"
  | "merged";

type OgInfo = {
  title: string | null;
  description: string | null;
  image: string | null;
  author: string | null;
};

function isStrongIngredients(draft: RecipeDraft | null): boolean {
  return (draft?.ingredients.length ?? 0) >= 2;
}

function isStrongSteps(draft: RecipeDraft | null): boolean {
  return (draft?.steps.length ?? 0) >= 1;
}

/**
 * 優先順位: 完全JSON-LD > AI本文 > OG > ルール
 * 部分JSON-LDはフィールド単位で残し、不足をAI等で補う
 */
export function mergeRecipeSources(input: {
  sourceUrl: string;
  jsonLd: RecipeDraft | null;
  jsonLdSufficient: boolean;
  ai: RecipeDraft | null;
  rules: RecipeDraft | null;
  og: OgInfo;
}): { draft: RecipeDraft; importSource: RecipeDraft["importSource"]; warnings: string[] } {
  const warnings: string[] = [];
  const sources: NonNullable<RecipeDraft["fieldSources"]> = {};

  if (input.jsonLdSufficient && input.jsonLd) {
    const draft = sanitizeRecipeDraft(
      {
        ...input.jsonLd,
        imageUrl: input.jsonLd.imageUrl || input.og.image || null,
        sourceAuthor: input.jsonLd.sourceAuthor || input.og.author || null,
        description: input.jsonLd.description || input.og.description || undefined,
        importSource: "json_ld",
        fieldSources: {
          title: "json_ld",
          ingredients: "json_ld",
          steps: "json_ld",
          servings: input.jsonLd.servings != null ? "json_ld" : undefined,
          imageUrl: input.jsonLd.imageUrl
            ? "json_ld"
            : input.og.image
              ? "open_graph"
              : undefined,
        },
      },
      input.sourceUrl,
    );
    return { draft, importSource: "json_ld", warnings: draft.warnings ?? [] };
  }

  const base: RecipeDraft = {
    ingredients: [],
    steps: [],
    importMethod: "url",
    importedAt: new Date().toISOString(),
    sourceUrl: input.sourceUrl,
    warnings: [],
  };

  // title
  if (input.jsonLd?.title) {
    base.title = input.jsonLd.title;
    sources.title = "json_ld";
  } else if (input.ai?.title) {
    base.title = input.ai.title;
    sources.title = "ai_html";
  } else if (input.rules?.title) {
    base.title = input.rules.title;
    sources.title = "html_rules";
  } else if (input.og.title) {
    base.title = input.og.title;
    sources.title = "open_graph";
  }

  // ingredients
  if (isStrongIngredients(input.jsonLd)) {
    base.ingredients = input.jsonLd!.ingredients;
    sources.ingredients = "json_ld";
  } else if (isStrongIngredients(input.ai) || (input.ai?.ingredients.length ?? 0) > 0) {
    base.ingredients = input.ai!.ingredients;
    sources.ingredients = "ai_html";
    if (input.jsonLd && input.jsonLd.ingredients.length > 0) {
      warnings.push("材料はAI解析結果を優先し、JSON-LDの部分情報は補助としました");
    }
  } else if ((input.rules?.ingredients.length ?? 0) > 0) {
    base.ingredients = input.rules!.ingredients;
    sources.ingredients = "html_rules";
  } else if ((input.jsonLd?.ingredients.length ?? 0) > 0) {
    base.ingredients = input.jsonLd!.ingredients;
    sources.ingredients = "json_ld";
  }

  // steps
  if (isStrongSteps(input.jsonLd) && (input.jsonLd!.steps.length ?? 0) >= 1) {
    // JSON-LD steps exist but overall not sufficient - still prefer if AI weak
    if (!isStrongSteps(input.ai)) {
      base.steps = input.jsonLd!.steps;
      sources.steps = "json_ld";
    } else {
      base.steps = input.ai!.steps;
      sources.steps = "ai_html";
      warnings.push("手順はAI解析で補完しました");
    }
  } else if (isStrongSteps(input.ai) || (input.ai?.steps.length ?? 0) > 0) {
    base.steps = input.ai!.steps;
    sources.steps = "ai_html";
    if (input.jsonLd && !isStrongSteps(input.jsonLd)) {
      warnings.push("JSON-LDに手順が無かったためAI結果で補完しました");
    }
  } else if ((input.rules?.steps.length ?? 0) > 0) {
    base.steps = input.rules!.steps;
    sources.steps = "html_rules";
  }

  // servings / times / description / image
  if (input.jsonLd?.servings != null) {
    base.servings = input.jsonLd.servings;
    base.servingsText = input.jsonLd.servingsText;
    sources.servings = "json_ld";
  } else if (input.ai?.servings != null) {
    base.servings = input.ai.servings;
    base.servingsText = input.ai.servingsText;
    sources.servings = "ai_html";
  } else if (input.rules?.servings != null) {
    base.servings = input.rules.servings;
    base.servingsText = input.rules.servingsText;
    sources.servings = "html_rules";
  }

  base.description =
    input.jsonLd?.description ||
    input.ai?.description ||
    input.og.description ||
    input.rules?.description;
  if (base.description) {
    sources.description = input.jsonLd?.description
      ? "json_ld"
      : input.ai?.description
        ? "ai_html"
        : input.og.description
          ? "open_graph"
          : "html_rules";
  }

  base.imageUrl =
    input.jsonLd?.imageUrl || input.og.image || input.ai?.imageUrl || null;
  if (base.imageUrl) {
    sources.imageUrl = input.jsonLd?.imageUrl
      ? "json_ld"
      : input.og.image
        ? "open_graph"
        : "ai_html";
  }

  base.prepTimeMinutes =
    input.jsonLd?.prepTimeMinutes ?? input.ai?.prepTimeMinutes ?? null;
  base.cookTimeMinutes =
    input.jsonLd?.cookTimeMinutes ?? input.ai?.cookTimeMinutes ?? null;
  base.totalTimeMinutes =
    input.jsonLd?.totalTimeMinutes ??
    input.ai?.totalTimeMinutes ??
    input.rules?.totalTimeMinutes ??
    null;
  if (
    base.prepTimeMinutes != null ||
    base.cookTimeMinutes != null ||
    base.totalTimeMinutes != null
  ) {
    sources.times = input.jsonLd?.totalTimeMinutes != null ||
      input.jsonLd?.cookTimeMinutes != null
      ? "json_ld"
      : "ai_html";
  }

  base.cuisine = input.ai?.cuisine ?? input.jsonLd?.cuisine ?? null;
  base.mealRole = input.ai?.mealRole ?? input.jsonLd?.mealRole ?? null;
  base.stapleType = input.ai?.stapleType ?? input.jsonLd?.stapleType ?? null;
  base.mealStyle = input.ai?.mealStyle ?? input.jsonLd?.mealStyle ?? null;
  base.tags = input.ai?.tags ?? input.jsonLd?.tags ?? [];
  base.sourceAuthor =
    input.jsonLd?.sourceAuthor || input.og.author || input.ai?.sourceAuthor || null;
  base.sourceTitle = base.title;
  base.documentType = input.ai?.documentType ?? null;

  const usedAi = Boolean(input.ai);
  const usedJson = Boolean(input.jsonLd);
  const importSource: RecipeDraft["importSource"] =
    usedAi && usedJson
      ? "hybrid"
      : usedAi
        ? "ai_html"
        : usedJson
          ? "json_ld"
          : input.rules
            ? "html_rules"
            : "failed";

  if (base.ingredients.length > 0 && base.steps.length === 0) {
    warnings.push("材料は読み取れましたが、作り方を確認できませんでした");
  }
  if (base.steps.length > 0 && base.ingredients.length === 0) {
    warnings.push("作り方は読み取れましたが、材料の確認が必要です");
  }

  const mergedWarnings = [
    ...warnings,
    ...(input.ai?.warnings ?? []),
    ...(input.jsonLd?.warnings ?? []),
  ].filter((w, i, arr) => arr.indexOf(w) === i);

  const draft = sanitizeRecipeDraft(
    {
      ...base,
      importSource,
      fieldSources: sources,
      warnings: mergedWarnings,
      confidence:
        base.ingredients.length >= 2 && base.steps.length >= 1 ? "medium" : "low",
    },
    input.sourceUrl,
  );

  return { draft, importSource, warnings: mergedWarnings };
}
