import { textContent } from "@/lib/recipe-import/html/dom";
import { parseIngredientLine } from "@/lib/recipe-import/parse-ingredient";
import type { RecipeSiteAdapter } from "@/lib/recipe-import/adapters/types";
import type { RecipeDraftIngredient, RecipeDraftStep } from "@/types/recipe-import";

/**
 * BONIQ 系ページ向けアダプター。
 * セレクタはここに隔離する。
 */
export const boniqRecipeAdapter: RecipeSiteAdapter = {
  name: "BoniqRecipeAdapter",
  canHandle(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return (
        host.includes("boniq.jp") ||
        host.includes("boniq.store") ||
        host.includes("boniq.com")
      );
    } catch {
      return false;
    }
  },
  extract($, url, og, generic) {
    // 汎用結果が十分ならそれを優先的に返す（ドメイン専用は不足時のみ強化）
    if (
      (generic.draft.ingredients?.length ?? 0) >= 2 &&
      (generic.draft.steps?.length ?? 0) >= 1
    ) {
      return {
        draft: {
          ...generic.draft,
          importSource: "html_rules",
          warnings: [
            ...(generic.draft.warnings ?? []),
            "BONIQページを汎用HTML解析で読み取りました",
          ],
        },
        detectedSections: generic.detectedSections,
        ingredientCandidateCount: generic.ingredientCandidateCount,
        stepCandidateCount: generic.stepCandidateCount,
        excludedCount: generic.excludedCount,
        adapterName: "BoniqRecipeAdapter",
      };
    }

    const ingredients: RecipeDraftIngredient[] = [...(generic.draft.ingredients ?? [])];
    const steps: RecipeDraftStep[] = [...(generic.draft.steps ?? [])];
    const sections = [...generic.detectedSections];

    // BONIQ記事でよくある見出し周辺
    $("h2, h3, .title, .heading").each((_, el) => {
      const title = textContent($, el);
      if (/材料|調味料|用意/.test(title)) {
        sections.push(`boniq材料:${title}`);
        let next = $(el).next();
        for (let i = 0; i < 20 && next.length > 0; i += 1) {
          if (/^H[1-6]$/i.test(next.prop("tagName") ?? "")) break;
          next.find("li, p, tr, dd").each((__, item) => {
            const raw = textContent($, item);
            if (!raw || raw.length > 100) return;
            const parsed = parseIngredientLine(raw);
            if (!parsed.name) return;
            if (ingredients.some((ing) => ing.rawText === raw)) return;
            ingredients.push({
              rawText: raw,
              name: parsed.name,
              quantity: parsed.quantity,
              quantityText: parsed.quantityText,
              unit: parsed.unit,
              note: parsed.note,
              alias: parsed.alias,
              confidence: "medium",
            });
          });
          next = next.next();
        }
      }
      if (/作り方|手順|工程|加熱/.test(title)) {
        sections.push(`boniq手順:${title}`);
        let next = $(el).next();
        for (let i = 0; i < 30 && next.length > 0; i += 1) {
          if (/^H[1-6]$/i.test(next.prop("tagName") ?? "")) break;
          next.find("li, p, .step").addBack("p, li").each((__, item) => {
            const raw = textContent($, item);
            if (!raw || raw.length < 3) return;
            if (/シェア|関連|おすすめ|BONIQ公式/.test(raw)) return;
            if (steps.some((step) => step.text === raw)) return;
            steps.push({
              order: steps.length + 1,
              text: raw.replace(/^(?:STEP\s*)?\d+[\.．:：)\s-]*/i, "").trim(),
              confidence: "medium",
            });
          });
          next = next.next();
        }
      }
    });

    const title =
      generic.draft.title ||
      $("h1").first().text().trim() ||
      og.title ||
      "BONIQレシピ";

    const warnings = [
      "構造化レシピ情報が見つからなかったため、ページ本文から読み取りました",
    ];
    if (ingredients.length > 0 && steps.length === 0) {
      warnings.push("材料は読み取れましたが、作り方を確認できませんでした");
    }
    if (steps.length > 0 && ingredients.length === 0) {
      warnings.push("作り方は読み取れましたが、材料の確認が必要です");
    }

    return {
      draft: {
        ...generic.draft,
        title,
        imageUrl: generic.draft.imageUrl || og.image || undefined,
        description: generic.draft.description || og.description || undefined,
        ingredients,
        steps,
        sourceUrl: url,
        importSource: "html_rules",
        warnings,
        confidence: ingredients.length + steps.length >= 3 ? "medium" : "low",
      },
      detectedSections: sections,
      ingredientCandidateCount: Math.max(
        generic.ingredientCandidateCount,
        ingredients.length,
      ),
      stepCandidateCount: Math.max(generic.stepCandidateCount, steps.length),
      excludedCount: generic.excludedCount,
      adapterName: "BoniqRecipeAdapter",
    };
  },
};

export const cookpadRecipeAdapter: RecipeSiteAdapter = {
  name: "CookpadRecipeAdapter",
  canHandle(url) {
    try {
      return new URL(url).hostname.toLowerCase().includes("cookpad.com");
    } catch {
      return false;
    }
  },
  extract(_$, _url, _og, generic) {
    // Cookpad は通常 JSON-LD がある。フォールバック時は汎用結果をそのまま使う。
    return {
      draft: generic.draft,
      detectedSections: generic.detectedSections,
      ingredientCandidateCount: generic.ingredientCandidateCount,
      stepCandidateCount: generic.stepCandidateCount,
      excludedCount: generic.excludedCount,
      adapterName: "CookpadRecipeAdapter",
    };
  },
};

export const genericRecipeHtmlAdapter: RecipeSiteAdapter = {
  name: "GenericRecipeHtmlAdapter",
  canHandle() {
    return true;
  },
  extract(_$, _url, _og, generic) {
    return {
      draft: generic.draft,
      detectedSections: generic.detectedSections,
      ingredientCandidateCount: generic.ingredientCandidateCount,
      stepCandidateCount: generic.stepCandidateCount,
      excludedCount: generic.excludedCount,
      adapterName: "GenericRecipeHtmlAdapter",
    };
  },
};

export function selectAdapters(url: string, html: string): RecipeSiteAdapter[] {
  const all = [boniqRecipeAdapter, cookpadRecipeAdapter, genericRecipeHtmlAdapter];
  const matched = all.filter((adapter) => adapter.canHandle(url, html));
  return matched.length > 0 ? matched : [genericRecipeHtmlAdapter];
}
