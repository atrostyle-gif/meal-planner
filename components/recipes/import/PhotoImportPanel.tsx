"use client";

import Image from "next/image";
import { useState } from "react";
import { ImportReviewPanel } from "@/components/recipes/import/ImportReviewPanel";
import {
  compressImageFile,
  MAX_IMPORT_IMAGES,
  type CompressedImage,
} from "@/lib/recipe-import/image-client";
import type { PhotoKind, RecipeDraft } from "@/types/recipe-import";

type ImageItem = CompressedImage & { id: string };
type ResponsePayload = { draft?: RecipeDraft; error?: string };

export function PhotoImportPanel() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [photoKindHint, setPhotoKindHint] = useState<PhotoKind>("unknown");
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function addFiles(files: FileList | null): Promise<void> {
    if (!files) return;
    const selected = Array.from(files);
    if (images.length + selected.length > MAX_IMPORT_IMAGES) {
      setError(`画像は最大${MAX_IMPORT_IMAGES}枚です。`);
      return;
    }
    try {
      const compressed = await Promise.all(selected.map(compressImageFile));
      setImages((current) => [...current, ...compressed.map((image) => ({ ...image, id: crypto.randomUUID() }))]);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "画像を追加できませんでした。");
    }
  }

  async function readImages(): Promise<void> {
    if (images.length === 0) {
      setError("画像を1枚以上追加してください。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/recipes/import-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((image, order) => ({ order, mimeType: image.mimeType, dataBase64: image.base64 })),
          photoKindHint,
        }),
      });
      const payload = (await response.json()) as ResponsePayload;
      if (!response.ok || !payload.draft) throw new Error(payload.error ?? "読み取りに失敗しました。");
      setDraft(payload.draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "読み取りに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  function move(index: number, direction: -1 | 1): void {
    setImages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <p className="text-sm text-on-surface-variant">画像は読み取り処理のため外部AIサービスへ送信される場合があります。個人情報や不要な情報が写らない画像を選んでください。</p>
        <label className="block space-y-2">
          <span className="text-sm font-medium">画像の種類</span>
          <select value={photoKindHint} onChange={(event) => setPhotoKindHint(event.target.value as PhotoKind)} className="w-full rounded-xl bg-surface-container px-3 py-3 ring-1 ring-outline-variant">
            <option value="unknown">わからない</option><option value="recipe_book">レシピ本・印刷物</option><option value="handwritten">手書きメモ</option><option value="web_screenshot">Webページのスクリーンショット</option><option value="ingredients_only">材料のみ</option><option value="steps_only">手順のみ</option><option value="finished_dish">完成料理のみ</option>
          </select>
        </label>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void addFiles(event.target.files)} />
        <div className="grid grid-cols-2 gap-3">
          {images.map((image, index) => (
            <div key={image.id} className="space-y-2 rounded-xl bg-surface-container p-2">
              <Image
                src={image.previewUrl}
                alt={`選択した画像 ${index + 1}`}
                width={320}
                height={320}
                unoptimized
                className="aspect-square w-full rounded-lg object-cover"
              />
              <div className="flex justify-between text-xs">
                <button type="button" onClick={() => move(index, -1)}>←</button>
                <button type="button" onClick={() => move(index, 1)}>→</button>
                <button type="button" className="text-error" onClick={() => setImages((current) => current.filter((item) => item.id !== image.id))}>削除</button>
              </div>
            </div>
          ))}
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <button type="button" disabled={loading} onClick={() => void readImages()} className="w-full rounded-2xl bg-primary px-4 py-3 font-semibold text-on-primary disabled:opacity-60">
          {loading ? "読み取り中…" : "画像を読み取る"}
        </button>
      </section>
      {draft ? <ImportReviewPanel draft={draft} /> : null}
    </div>
  );
}
