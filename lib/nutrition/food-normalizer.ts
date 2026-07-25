/**
 * 材料名・食品名の正規化と alias 解決。
 */

/** よくある表記ゆれ → 代表名 */
export const FOOD_NAME_ALIASES: Record<string, string> = {
  豚バラ: "豚ばら肉",
  豚ばら: "豚ばら肉",
  豚バラ肉: "豚ばら肉",
  豚こま: "豚こま切れ",
  豚小間: "豚こま切れ",
  しょう油: "濃口しょうゆ",
  醤油: "濃口しょうゆ",
  しょうゆ: "濃口しょうゆ",
  こいくちしょうゆ: "濃口しょうゆ",
  玉ネギ: "玉ねぎ",
  たまねぎ: "玉ねぎ",
  玉葱: "玉ねぎ",
  オニオン: "玉ねぎ",
  人参: "にんじん",
  ニンジン: "にんじん",
  じゃがいも: "じゃがいも",
  ジャガイモ: "じゃがいも",
  馬鈴薯: "じゃがいも",
  鶏もも: "鶏もも肉（皮つき）",
  とりもも: "鶏もも肉（皮つき）",
  鶏モモ肉: "鶏もも肉（皮つき）",
  鶏むね: "鶏むね肉（皮なし）",
  鶏胸肉: "鶏むね肉（皮なし）",
  卵: "鶏卵",
  たまご: "鶏卵",
  玉子: "鶏卵",
  ごはん: "うるち米（精白米）",
  ご飯: "うるち米（精白米）",
  白米: "うるち米（精白米）",
  米: "うるち米（精白米）",
  豆腐: "木綿豆腐",
  油: "サラダ油",
  サラダ油: "サラダ油",
  植物油: "サラダ油",
  塩: "食塩",
  砂糖: "上白糖",
  白砂糖: "上白糖",
  みそ: "味噌（米みそ）",
  味噌: "味噌（米みそ）",
  酒: "酒（料理酒）",
  料理酒: "酒（料理酒）",
  みりん: "みりん",
  本みりん: "みりん",
  にんにく: "にんにく",
  生姜: "しょうが",
  しょうが: "しょうが",
  ネギ: "ねぎ",
  長ねぎ: "ねぎ",
  さば: "さば",
  サバ: "さば",
  鮭: "鮭",
  サーモン: "鮭",
  ひき肉: "合いびき肉",
  挽き肉: "合いびき肉",
  合挽き: "合いびき肉",
  カレールー: "カレールウ",
  ルー: "カレールウ",
  わかめ: "わかめ（塩蔵・戻し）",
  のり: "のり（焼き）",
  海苔: "のり（焼き）",
  パン: "パン（食パン）",
  食パン: "パン（食パン）",
};

export function normalizeFoodName(name: string): string {
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[・･]/g, "")
    .replace(/（.*?）|\(.*?\)/g, "")
    .replace(/【.*?】|\[.*?\]/g, "");
}

/**
 * alias 辞書で代表名へ寄せる。
 * 辞書に無い場合はトリムした元名を返す。
 */
export function canonicalizeFoodLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const normalized = normalizeFoodName(trimmed);
  for (const [from, to] of Object.entries(FOOD_NAME_ALIASES)) {
    if (normalizeFoodName(from) === normalized) {
      return to;
    }
  }
  // 空白除去後のキーでも再検索
  for (const [from, to] of Object.entries(FOOD_NAME_ALIASES)) {
    if (normalizeFoodName(from) === normalized.replace(/\s/g, "")) {
      return to;
    }
  }
  return trimmed;
}

export function resolveAliasKey(name: string): string {
  return normalizeFoodName(canonicalizeFoodLabel(name));
}
