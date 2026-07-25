import type { RecipeDraft } from "@/types/recipe-import";
import { extractMainTextForAi } from "@/lib/recipe-import/html/dom";

export type AiHtmlResult = {
  draft: RecipeDraft | null;
  skipped: boolean;
  skipReason: string | null;
  ran: boolean;
  error: string | null;
};

function shouldRunAi(draft: RecipeDraft | null): boolean {
  if (!draft) return true;
  const ingredients = draft.ingredients?.length ?? 0;
  const steps = draft.steps?.length ?? 0;
  if (ingredients === 0 && steps === 0) return true;
  if (ingredients === 0 || steps === 0) return true;
  if (ingredients + steps < 3) return true;
  return false;
}

/** テスト・診断用に公開。不正JSONでも例外を投げない */
export function parseAiJson(text: string): Partial<RecipeDraft> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as Partial<RecipeDraft>;
  } catch {
    return null;
  }
}

/**
 * ルールベース不足時のみ AI で HTML 要約テキストを構造化。
 * OPENAI_API_KEY が無い場合はスキップ。
 */
export async function analyzeHtmlWithAi(
  html: string,
  sourceUrl: string,
  current: RecipeDraft | null,
): Promise<AiHtmlResult> {
  if (!shouldRunAi(current)) {
    return {
      draft: current,
      skipped: true,
      skipReason: "ルールベース抽出で十分な内容があるためスキップ",
      ran: false,
      error: null,
    };
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      draft: current,
      skipped: true,
      skipReason: "OPENAI_API_KEY が未設定のためスキップ",
      ran: false,
      error: null,
    };
  }

  const clipped = extractMainTextForAi(html);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "あなたはレシピ抽出器です。ページに書かれている内容だけを抽出してください。不明な分量は推測しない。材料や手順を創作しない。取れない項目はnull。広告や関連記事を混ぜない。JSONで title, description, servings, totalTimeMinutes, ingredients[{rawText,name,quantity,unit,groupName}], steps[{order,text}], warnings[] を返す。",
          },
          {
            role: "user",
            content: `出典URL: ${sourceUrl}\n本文:\n${clipped}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      return {
        draft: current,
        skipped: false,
        skipReason: null,
        ran: true,
        error: `AI API error ${response.status}`,
      };
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = parseAiJson(content);
    if (!parsed) {
      return {
        draft: current,
        skipped: false,
        skipReason: null,
        ran: true,
        error: "AIが不正なJSONを返しました",
      };
    }
    const draft: RecipeDraft = {
      title: parsed.title || current?.title,
      description: parsed.description || current?.description,
      servings: parsed.servings ?? current?.servings ?? null,
      totalTimeMinutes: parsed.totalTimeMinutes ?? current?.totalTimeMinutes ?? null,
      ingredients: Array.isArray(parsed.ingredients)
        ? parsed.ingredients
        : current?.ingredients ?? [],
      steps: Array.isArray(parsed.steps) ? parsed.steps : current?.steps ?? [],
      imageUrl: current?.imageUrl ?? null,
      sourceUrl,
      importMethod: "url",
      importedAt: new Date().toISOString(),
      importSource: "ai_html",
      confidence: "low",
      warnings: [
        "構造化レシピ情報が見つからなかったため、ページ本文から読み取りました",
        ...(parsed.warnings ?? []),
        ...(current?.warnings ?? []).filter((w) => !w.includes("構造化レシピ")),
      ],
    };
    return {
      draft,
      skipped: false,
      skipReason: null,
      ran: true,
      error: null,
    };
  } catch (error) {
    return {
      draft: current,
      skipped: false,
      skipReason: null,
      ran: true,
      error: error instanceof Error ? error.message : "AI解析に失敗しました",
    };
  }
}
