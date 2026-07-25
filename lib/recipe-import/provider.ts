import type {
  PhotoKind,
  RecipeDraft,
  RecipeDraftIngredient,
  RecipeDraftStep,
} from "@/types/recipe-import";

export type RecipeImportImage = {
  order: number;
  mimeType: string;
  base64: string;
  photoKindHint?: PhotoKind;
};

export type RecipeImportProvider = {
  importFromImage(images: RecipeImportImage[]): Promise<RecipeDraft>;
  structureRecipeText?(text: string): Promise<RecipeDraft>;
};

type StructuredDraftPayload = Partial<RecipeDraft> & {
  ingredients?: RecipeDraftIngredient[];
  steps?: RecipeDraftStep[];
};

function emptyPhotoDraft(
  photoKind: PhotoKind = "unknown",
  warning = "画像から材料や手順を確認できませんでした。原本を見ながら入力してください。",
): RecipeDraft {
  return {
    title: "画像から取り込んだレシピ",
    ingredients: [],
    steps: [],
    importMethod: "photo",
    importedAt: new Date().toISOString(),
    photoKind,
    warnings: [warning],
    confidence: "low",
  };
}

function normalizeDraft(payload: StructuredDraftPayload): RecipeDraft {
  return {
    ...emptyPhotoDraft(payload.photoKind ?? "unknown"),
    ...payload,
    ingredients: Array.isArray(payload.ingredients) ? payload.ingredients : [],
    steps: Array.isArray(payload.steps) ? payload.steps : [],
    importMethod: "photo",
    importedAt: new Date().toISOString(),
    warnings: payload.warnings ?? [],
  };
}

function decodeTestPayload(images: RecipeImportImage[]): StructuredDraftPayload | null {
  for (const image of images) {
    try {
      const text = Buffer.from(image.base64, "base64").toString("utf-8").trim();
      if (!text.startsWith("{")) continue;
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as StructuredDraftPayload;
      }
    } catch {
      // 画像本体は JSON ではないため次の画像を確認する
    }
  }
  return null;
}

export class MockRecipeImportProvider implements RecipeImportProvider {
  async importFromImage(images: RecipeImportImage[]): Promise<RecipeDraft> {
    const photoKind = images[0]?.photoKindHint ?? "unknown";
    if (photoKind === "finished_dish") {
      return emptyPhotoDraft(
        "finished_dish",
        "完成料理の写真だけでは材料や手順を正確に特定できません。推測で登録していません。",
      );
    }

    const testPayload = decodeTestPayload(images);
    if (testPayload) {
      if (testPayload.photoKind === "finished_dish") {
        return emptyPhotoDraft("finished_dish");
      }
      return normalizeDraft(testPayload);
    }

    return emptyPhotoDraft(
      photoKind,
      "画像読み取りは現在モックモードです。材料・手順を確認して入力してください。",
    );
  }

  async structureRecipeText(text: string): Promise<RecipeDraft> {
    const title = text.split(/\r?\n/).find((line) => line.trim() !== "")?.trim();
    return normalizeDraft({
      title: title || "テキストから取り込んだレシピ",
      warnings: ["テキストを確認して材料・手順を入力してください。"],
    });
  }
}

function extractJson(content: string): StructuredDraftPayload {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? content;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("画像の読み取り結果を処理できませんでした。");
  }
  const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("画像の読み取り結果を処理できませんでした。");
  }
  return parsed as StructuredDraftPayload;
}

export class OpenAIRecipeImportProvider implements RecipeImportProvider {
  async importFromImage(images: RecipeImportImage[]): Promise<RecipeDraft> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("画像取り込みを使うには OPENAI_API_KEY を設定してください。");
    }
    const photoKind = images[0]?.photoKindHint ?? "unknown";
    if (photoKind === "finished_dish") {
      return emptyPhotoDraft(
        "finished_dish",
        "完成料理の写真だけでは材料や手順を正確に特定できません。推測で登録していません。",
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "画像内で明確に読めるレシピ情報だけをJSONで返してください。推測は禁止です。title, ingredients([{rawText,name,quantity,quantityText,unit,note,confidence}]), steps([{order,text,confidence}]), warnings を返してください。",
          },
          {
            role: "user",
            content: images.map((image) => ({
              type: "image_url",
              image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
            })),
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error("画像の読み取りに失敗しました。時間をおいて再試行してください。");
    }
    const body: unknown = await response.json();
    const content =
      typeof body === "object" &&
      body !== null &&
      Array.isArray((body as { choices?: unknown }).choices)
        ? ((body as { choices: Array<{ message?: { content?: unknown } }> }).choices[0]
            ?.message?.content ?? "")
        : "";
    if (typeof content !== "string") {
      throw new Error("画像の読み取り結果を処理できませんでした。");
    }
    return normalizeDraft(extractJson(content));
  }
}

export function getRecipeImportProvider(): RecipeImportProvider {
  return process.env.OPENAI_API_KEY
    ? new OpenAIRecipeImportProvider()
    : new MockRecipeImportProvider();
}
