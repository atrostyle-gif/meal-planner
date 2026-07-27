/**
 * 同一レシート重複防止用フィンガープリント。
 * 店舗 + 購入日 + 合計 + 商品名と金額 + 画像ハッシュ（任意）
 */
export async function buildReceiptFingerprint(input: {
  storeName: string;
  purchasedAt: string | null;
  totalAmountYen: number | null;
  itemNames: string[];
  itemPrices?: Array<{ name: string; totalPriceYen: number | null }>;
  imageBase64?: string | null;
}): Promise<string> {
  const itemPart =
    input.itemPrices && input.itemPrices.length > 0
      ? [...input.itemPrices]
          .map(
            (i) =>
              `${i.name.trim().toLowerCase()}:${i.totalPriceYen ?? ""}`,
          )
          .sort()
          .join("|")
      : [...input.itemNames]
          .map((n) => n.trim().toLowerCase())
          .sort()
          .join("|");

  const parts = [
    input.storeName.trim().toLowerCase(),
    input.purchasedAt?.slice(0, 10) ?? "",
    input.totalAmountYen == null ? "" : String(input.totalAmountYen),
    itemPart,
  ];
  let imagePart = "";
  if (input.imageBase64 && input.imageBase64.length > 0) {
    imagePart = await hashText(input.imageBase64.slice(0, 8000));
  }
  return hashText(`${parts.join("::")}::${imagePart}`);
}

async function hashText(text: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  return `fallback-${h.toString(16)}`;
}
