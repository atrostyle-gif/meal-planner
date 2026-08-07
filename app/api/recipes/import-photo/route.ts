import { NextResponse } from "next/server";
import {
  getRecipeImportProvider,
  type RecipeImportImage,
} from "@/lib/recipe-import/provider";
import { MAX_IMPORT_IMAGES } from "@/lib/recipe-import/image-client";
import { PHOTO_KINDS, type PhotoKind } from "@/types/recipe-import";

type ImagePayload = {
  order?: unknown;
  mimeType?: unknown;
  dataBase64?: unknown;
};

type ImportPhotoRequest = {
  images?: unknown;
  photoKindHint?: unknown;
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isPhotoKind(value: unknown): value is PhotoKind {
  return typeof value === "string" && (PHOTO_KINDS as readonly string[]).includes(value);
}

function parseImages(value: unknown, photoKindHint: PhotoKind): RecipeImportImage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IMPORT_IMAGES) {
    return null;
  }
  const images: RecipeImportImage[] = [];
  for (const item of value) {
    const image = item as ImagePayload;
    if (
      typeof image.order !== "number" ||
      !Number.isInteger(image.order) ||
      typeof image.mimeType !== "string" ||
      !ALLOWED_TYPES.has(image.mimeType) ||
      typeof image.dataBase64 !== "string" ||
      image.dataBase64.length === 0 ||
      image.dataBase64.length > 14_000_000
    ) {
      return null;
    }
    images.push({
      order: image.order,
      mimeType: image.mimeType,
      base64: image.dataBase64,
      photoKindHint,
    });
  }
  return images.sort((a, b) => a.order - b.order);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ImportPhotoRequest;
    const photoKindHint = isPhotoKind(body.photoKindHint) ? body.photoKindHint : "unknown";
    const images = parseImages(body.images, photoKindHint);
    if (!images) {
      return NextResponse.json(
        { code: "invalid_images", error: `JPEG、PNG、WebP画像を1〜${MAX_IMPORT_IMAGES}枚送信してください。` },
        { status: 400 },
      );
    }
    const draft = await getRecipeImportProvider().importFromImage(images);
    return NextResponse.json({ draft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "画像の読み取りに失敗しました。";
    return NextResponse.json({ code: "import_failed", error: message }, { status: 500 });
  }
}
