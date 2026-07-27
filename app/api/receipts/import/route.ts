import { NextResponse } from "next/server";
import { getReceiptImportProvider } from "@/lib/receipt/provider";
import { z } from "zod";

const bodySchema = z.object({
  images: z
    .array(
      z.object({
        order: z.number(),
        mimeType: z.string(),
        dataBase64: z.string(),
      }),
    )
    .min(1)
    .max(3),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "画像データが不正です" },
        { status: 400 },
      );
    }

    const provider = getReceiptImportProvider();
    const draft = await provider.importFromImage(
      parsed.data.images.map((image) => ({
        order: image.order,
        mimeType: image.mimeType,
        base64: image.dataBase64,
      })),
    );

    // 画像はレスポンスに含めず破棄（永続化しない）
    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json(
      { error: "レシート解析に失敗しました" },
      { status: 500 },
    );
  }
}
