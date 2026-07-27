"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  compressImageFile,
  type CompressedImage,
} from "@/lib/recipe-import/image-client";
import { buildReceiptConfirmState } from "@/lib/receipt/confirm";
import {
  saveReceiptConfirmSession,
  saveReceiptDraftSession,
} from "@/lib/receipt/draft-session";
import type { ReceiptDraft } from "@/types/receipt";

type ImageItem = CompressedImage & { id: string };

export function ReceiptImportPanel() {
  const router = useRouter();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function addFiles(fileList: FileList | null): Promise<void> {
    if (!fileList || fileList.length === 0) return;
    const selected = [...fileList].slice(0, 3 - images.length);
    try {
      const compressed = await Promise.all(selected.map(compressImageFile));
      setImages((current) => [
        ...current,
        ...compressed.map((image) => ({
          ...image,
          id: crypto.randomUUID(),
        })),
      ]);
      setMessage(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "画像の読み込みに失敗しました",
      );
    }
  }

  async function handleAnalyze(): Promise<void> {
    if (images.length === 0) {
      setMessage("レシート写真を追加してください");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/receipts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((image, order) => ({
            order,
            mimeType: image.mimeType,
            dataBase64: image.base64,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error("解析に失敗しました");
      }
      const data = (await response.json()) as { draft: ReceiptDraft };
      saveReceiptDraftSession(data.draft);
      // フィンガープリント用に先頭画像だけ一時利用し、確認後は破棄
      const confirm = await buildReceiptConfirmState(
        data.draft,
        images[0]?.base64 ?? null,
      );
      saveReceiptConfirmSession(confirm);
      // プレビューURLを解放
      for (const image of images) {
        URL.revokeObjectURL(image.previewUrl);
      }
      setImages([]);
      router.push("/receipts/confirm");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "解析に失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-on-surface-variant">手順 1 / 3</p>
        <h1 className="text-2xl font-bold tracking-tight">レシートを撮る</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          撮影または画像を選んで解析します。画像は登録後に端末へ残しません。
        </p>
      </header>

      <label className="block space-y-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <span className="text-sm font-medium">写真を追加</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          multiple
          onChange={(event) => void addFiles(event.target.files)}
          className="block w-full text-sm"
        />
      </label>

      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((image) => (
            <li
              key={image.id}
              className="relative overflow-hidden rounded-xl bg-surface-container"
            >
              <Image
                src={image.previewUrl}
                alt="レシート"
                width={200}
                height={200}
                unoptimized
                className="h-28 w-full object-cover"
              />
              <button
                type="button"
                className="absolute right-1 top-1 rounded bg-black/50 px-2 py-0.5 text-xs text-white"
                onClick={() => {
                  URL.revokeObjectURL(image.previewUrl);
                  setImages((current) =>
                    current.filter((item) => item.id !== image.id),
                  );
                }}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        disabled={loading || images.length === 0}
        onClick={() => void handleAnalyze()}
        className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary disabled:opacity-50"
      >
        {loading ? "解析中…" : "内容を確認する"}
      </button>

      {message ? (
        <p className="text-sm text-error" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
