import { receiptDraftSchema } from "@/lib/receipt/schema";
import type { ReceiptDraft, ReceiptItemDraft } from "@/types/receipt";

export type ReceiptImportImage = {
  order: number;
  mimeType: string;
  base64: string;
};

export type ReceiptImportProvider = {
  importFromImage(images: ReceiptImportImage[]): Promise<ReceiptDraft>;
};

function emptyDraft(warning: string): ReceiptDraft {
  return {
    storeRawName: null,
    storeName: null,
    storeBrandName: null,
    storeBranchName: null,
    purchasedAt: null,
    subtotalYen: null,
    discountYen: null,
    taxYen: null,
    totalAmountYen: null,
    paymentMethod: null,
    points: null,
    items: [],
    rawText: null,
    confidence: null,
    warnings: [warning],
  };
}

function normalizeItem(item: ReceiptItemDraft): ReceiptItemDraft {
  return {
    rawName: item.rawName?.trim() || "",
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
    packageCount: item.packageCount ?? null,
    packageQuantity: item.packageQuantity ?? null,
    packageUnit: item.packageUnit ?? null,
    gramsEquivalent: item.gramsEquivalent ?? null,
    unitPriceYen: item.unitPriceYen ?? null,
    totalPriceYen: item.totalPriceYen ?? null,
    discountYen: item.discountYen ?? null,
    taxIncluded: item.taxIncluded ?? null,
    reducedTax: item.reducedTax ?? null,
    confidence: item.confidence ?? null,
    warnings: Array.isArray(item.warnings) ? item.warnings : [],
  };
}

export function parseReceiptDraftJson(raw: unknown): ReceiptDraft {
  const parsed = receiptDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return emptyDraft(
      "レシート解析結果の形式が不正です。手入力で確認してください。",
    );
  }
  const data = parsed.data;
  const storeRawName =
    data.storeRawName ?? data.storeName ?? null;
  const storeName =
    data.storeName ??
    data.storeRawName ??
    (data.storeBrandName
      ? `${data.storeBrandName}${data.storeBranchName ?? ""}`
      : null);
  return {
    storeRawName,
    storeName,
    storeBrandName: data.storeBrandName ?? null,
    storeBranchName: data.storeBranchName ?? null,
    purchasedAt: data.purchasedAt,
    subtotalYen: data.subtotalYen ?? null,
    discountYen: data.discountYen ?? null,
    taxYen: data.taxYen ?? null,
    totalAmountYen: data.totalAmountYen,
    paymentMethod: data.paymentMethod ?? null,
    points: data.points ?? null,
    items: data.items.map(normalizeItem).filter((i) => i.rawName !== ""),
    rawText: data.rawText,
    confidence: data.confidence,
    warnings: data.warnings,
  };
}

/** テスト用: base64 が JSON のときその内容を返す */
function decodeTestPayload(
  images: ReceiptImportImage[],
): unknown | null {
  for (const image of images) {
    try {
      const text =
        typeof Buffer !== "undefined"
          ? Buffer.from(image.base64, "base64").toString("utf-8").trim()
          : atob(image.base64);
      if (!text.startsWith("{")) continue;
      return JSON.parse(text) as unknown;
    } catch {
      // 画像本体
    }
  }
  return null;
}

export class MockReceiptImportProvider implements ReceiptImportProvider {
  async importFromImage(images: ReceiptImportImage[]): Promise<ReceiptDraft> {
    const payload = decodeTestPayload(images);
    if (payload) {
      return parseReceiptDraftJson(payload);
    }
    return emptyDraft(
      "画像読み取りはモックモードです。確認画面で内容を入力してください。",
    );
  }
}

/**
 * OpenAI 実装。APIキーがあるときのみ使用。
 * 結果は必ず Zod で検証する。テストでは呼ばない。
 */
export class OpenAIReceiptImportProvider implements ReceiptImportProvider {
  async importFromImage(images: ReceiptImportImage[]): Promise<ReceiptDraft> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new MockReceiptImportProvider().importFromImage(images);
    }

    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_RECEIPT_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "あなたはレシート抽出器です。書いてある内容だけをJSONで返す。推測で埋めない。不明はnull。容量や価格を推測で確定しない。キー: storeRawName, storeName, storeBrandName, storeBranchName, purchasedAt, subtotalYen, discountYen, taxYen, totalAmountYen, paymentMethod, points, items[{rawName,quantity,unit,packageCount,packageQuantity,packageUnit,gramsEquivalent,unitPriceYen,totalPriceYen,discountYen,taxIncluded,reducedTax,confidence,warnings}], rawText, confidence, warnings[]。pointsはポイント、reducedTaxは軽減税率対象。",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "このレシート画像から商品と価格を抽出してください。",
            },
            ...images.map((image) => ({
              type: "image_url" as const,
              image_url: {
                url: `data:${image.mimeType};base64,${image.base64}`,
              },
            })),
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      return emptyDraft("レシートを読み取れませんでした。");
    }
    try {
      return parseReceiptDraftJson(JSON.parse(text) as unknown);
    } catch {
      return emptyDraft("解析結果のJSONが不正です。");
    }
  }
}

/** 将来の専用OCR差し替え口 */
export class FutureOcrReceiptImportProvider implements ReceiptImportProvider {
  async importFromImage(images: ReceiptImportImage[]): Promise<ReceiptDraft> {
    return new MockReceiptImportProvider().importFromImage(images);
  }
}

export function getReceiptImportProvider(): ReceiptImportProvider {
  if (process.env.RECEIPT_IMPORT_PROVIDER === "mock") {
    return new MockReceiptImportProvider();
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIReceiptImportProvider();
  }
  return new MockReceiptImportProvider();
}
