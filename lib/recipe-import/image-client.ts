const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_IMAGES = 10;

export type CompressedImage = {
  mimeType: string;
  base64: string;
  previewUrl: string;
};

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("この画像形式は読み込めませんでした。"));
    image.onload = () => resolve(image);
    image.src = url;
  });
}

export async function compressImageFile(file: File): Promise<CompressedImage> {
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new Error("画像は1枚10MB以下にしてください。");
  }
  if (file.type === "image/heic" || file.type === "image/heif") {
    throw new Error("HEIC画像はこのブラウザでは読み込めません。JPEGまたはPNGに変換してください。");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("JPEG、PNG、WebP形式の画像を選択してください。");
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const longEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longEdge > 1600 ? 1600 / longEdge : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像を処理できませんでした。");
  context.drawImage(image, 0, 0, width, height);

  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(mimeType, 0.86);
  const comma = dataUrl.indexOf(",");
  return {
    mimeType,
    base64: dataUrl.slice(comma + 1),
    previewUrl: dataUrl,
  };
}
