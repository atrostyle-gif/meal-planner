/**
 * 食材名の正規化（アレルギー・マスター紐付け共用）
 */

/** 全角英数・空白などを寄せる */
export function normalizeIngredientName(name: string): string {
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[・･]/g, "")
    .replace(/（.*?）|\(.*?\)/g, "");
}

/** よくある表記揺れの吸収 */
const ALIAS_NORMALIZE: Record<string, string> = {
  たまねぎ: "玉ねぎ",
  玉葱: "玉ねぎ",
  オニオン: "玉ねぎ",
  じゃがいも: "じゃがいも",
  ジャガイモ: "じゃがいも",
  馬鈴薯: "じゃがいも",
  にんじん: "にんじん",
  人参: "にんじん",
  ニンジン: "にんじん",
  鶏もも肉: "鶏もも肉",
  鶏モモ肉: "鶏もも肉",
  とりもも: "鶏もも肉",
  豚バラ肉: "豚バラ肉",
  豚ばら肉: "豚バラ肉",
  ごはん: "米",
  白米: "米",
  ご飯: "米",
  玉子: "卵",
  たまご: "卵",
  鶏卵: "卵",
};

export function canonicalizeIngredientLabel(name: string): string {
  const normalized = normalizeIngredientName(name);
  for (const [from, to] of Object.entries(ALIAS_NORMALIZE)) {
    if (normalizeIngredientName(from) === normalized) {
      return to;
    }
  }
  return name.trim();
}
