import type { ShoppingCategory } from "@/types/shopping-category";
import type { IngredientType } from "@/types/ingredient-meta";

/**
 * 材料名から買い物カテゴリを推定する（ヒューリスティック）。
 */
export function classifyShoppingCategory(
  ingredientName: string,
  ingredientType?: IngredientType,
): ShoppingCategory {
  const name = ingredientName.trim();

  if (ingredientType === "pantrySeasoning") {
    return "調味料";
  }
  if (ingredientType === "pantryFood") {
    if (/米|麺|パスタ|うどん|そば|春雨|きなこ|干し|乾燥|缶詰|缶/.test(name)) {
      return "乾物";
    }
    return "調味料";
  }

  if (
    /塩|しょうゆ|醤油|みそ|味噌|みりん|酒|酢|油|こしょう|胡椒|砂糖|コンソメ|だし|ソース|ケチャップ|マヨ|めんつゆ|オイスター|豆板|甜麺|鶏ガラスープ|顆粒/.test(
      name,
    )
  ) {
    return "調味料";
  }

  if (
    /牛肉|豚肉|鶏肉|豚ばら|牛もも|鶏むね|鶏もも|ひき肉|挽き肉|ベーコン|ハム|ソーセージ|肉/.test(
      name,
    )
  ) {
    return "肉";
  }

  if (
    /魚|鮭|サーモン|まぐろ|マグロ|さば|サバ|あじ|アジ|いわし|カツオ|たら|タラ|えび|エビ|いか|イカ|たこ|タコ|ホタテ|ほたて|しらす|ツナ/.test(
      name,
    )
  ) {
    return "魚";
  }

  if (/卵|牛乳|ヨーグルト|チーズ|バター|生クリーム|乳/.test(name)) {
    return "卵／乳製品";
  }

  if (
    /米|乾麺|パスタ|うどん|そば|春雨|納豆|豆腐|油揚げ|厚揚げ|こんにゃく|わかめ|のり|海苔|きくらげ|干し椎茸|干ししいたけ|缶詰|缶詰め/.test(
      name,
    )
  ) {
    return "乾物";
  }

  if (
    /野菜|キャベツ|レタス|玉ねぎ|たまねぎ|にんじん|人参|じゃがいも|ポテト|きゅうり|トマト|なす|茄子|ピーマン|ねぎ|葱|にら|ニラ|ほうれん草|小松菜|白菜|大根|ごぼう|れんこん|ブロッコリー|もやし|きのこ|しめじ|えのき|まいたけ|しいたけ|椎茸|かぼちゃ|南瓜|さつまいも|ズッキーニ|パプリカ|ハーブ|パセリ|大葉|しそ/.test(
      name,
    )
  ) {
    return "野菜";
  }

  return "その他";
}
