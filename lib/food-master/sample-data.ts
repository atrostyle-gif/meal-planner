import { migrateFoodMaster } from "@/lib/food-master/migrate";
import type {
  FoodCategory,
  FoodFreezableLevel,
  FoodIngredientMaster,
  FoodStorageType,
  GlycemicCategory,
  NutritionPer100g,
} from "@/types/food-master";

type MasterDraft = {
  id: string;
  canonicalName: string;
  aliases?: string[];
  category: FoodCategory;
  edibleUnit?: string;
  gramsPerUnit?: number | null;
  gramsPerTablespoon?: number | null;
  gramsPerTeaspoon?: number | null;
  nutrition: NutritionPer100g;
  pantryType?: string | null;
  seasonMonths?: number[];
  storageType?: FoodStorageType;
  freezable?: FoodFreezableLevel;
  recommendedShelfLifeDays?: number | null;
  substituteFoods?: string[];
  glycemicCategory?: GlycemicCategory;
  diabetesFriendly?: boolean | null;
  subcategory?: string | null;
  commonPackageSizes?: string[];
  typicalCookingMethods?: string[];
};

function n(
  calories: number,
  protein: number,
  fat: number,
  carbohydrates: number,
  fiber: number,
  saltEquivalent: number,
  calcium: number,
  iron: number,
  extras: Partial<NutritionPer100g> = {},
): NutritionPer100g {
  return {
    calories,
    protein,
    fat,
    carbohydrates,
    fiber,
    saltEquivalent,
    calcium,
    iron,
    vitaminA: extras.vitaminA ?? null,
    vitaminB1: extras.vitaminB1 ?? null,
    vitaminB2: extras.vitaminB2 ?? null,
    vitaminC: extras.vitaminC ?? null,
  };
}

/**
 * サンプル用食材マスター（日本食品標準成分表を参考にした概算値）。
 * 出典メモ: approximate / meal-planner-sample-v2
 */
const DRAFTS: MasterDraft[] = [
  { id: "fm-rice", canonicalName: "米", aliases: ["ご飯", "ごはん", "白米"], category: "穀類", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(168, 2.5, 0.3, 37.1, 0.3, 0, 3, 0.1), storageType: "room_temperature", freezable: "possible", recommendedShelfLifeDays: 365, glycemicCategory: "high" },
  { id: "fm-bread", canonicalName: "食パン", aliases: ["パン"], category: "穀類", edibleUnit: "枚", gramsPerUnit: 60, nutrition: n(264, 9.3, 4.4, 46.7, 2.3, 1.3, 29, 0.6), storageType: "room_temperature", freezable: "recommended", recommendedShelfLifeDays: 4, glycemicCategory: "high" },
  { id: "fm-udon", canonicalName: "うどん", aliases: ["うどん麺"], category: "穀類", edibleUnit: "玉", gramsPerUnit: 220, nutrition: n(105, 2.6, 0.4, 21.6, 0.8, 0.3, 7, 0.2), storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 3 },
  { id: "fm-soba", canonicalName: "そば", aliases: ["蕎麦"], category: "穀類", edibleUnit: "束", gramsPerUnit: 100, nutrition: n(132, 4.8, 0.6, 26, 1.6, 0.1, 16, 0.9), storageType: "room_temperature", freezable: "possible", recommendedShelfLifeDays: 180 },
  { id: "fm-pasta", canonicalName: "パスタ", aliases: ["スパゲティ", "スパゲッティ"], category: "穀類", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(371, 13, 1.9, 72, 2.5, 0, 20, 1.5), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 730 },
  { id: "fm-flour", canonicalName: "薄力粉", aliases: ["小麦粉", "面粉"], category: "穀類", edibleUnit: "g", gramsPerUnit: 1, gramsPerTablespoon: 6, nutrition: n(368, 8.3, 1.5, 75.2, 2.1, 0, 20, 0.8), storageType: "room_temperature", freezable: "possible", recommendedShelfLifeDays: 180 },
  { id: "fm-potato", canonicalName: "じゃがいも", aliases: ["ジャガイモ", "ポテト"], category: "野菜", edibleUnit: "個", gramsPerUnit: 150, nutrition: n(76, 1.6, 0.1, 17.6, 1.3, 0, 3, 0.4, { vitaminC: 35 }), seasonMonths: [5, 6, 7, 8, 9], storageType: "room_temperature", freezable: "possible", recommendedShelfLifeDays: 14, glycemicCategory: "medium" },
  { id: "fm-onion", canonicalName: "玉ねぎ", aliases: ["たまねぎ", "玉葱", "オニオン"], category: "野菜", edibleUnit: "個", gramsPerUnit: 200, nutrition: n(37, 1, 0.1, 8.8, 1.6, 0, 21, 0.2, { vitaminC: 8 }), seasonMonths: [3, 4, 5, 6], storageType: "room_temperature", freezable: "possible", recommendedShelfLifeDays: 21 },
  { id: "fm-carrot", canonicalName: "にんじん", aliases: ["人参", "ニンジン"], category: "野菜", edibleUnit: "本", gramsPerUnit: 150, nutrition: n(39, 0.7, 0.2, 9.1, 2.8, 0.1, 28, 0.2, { vitaminA: 720, vitaminC: 6 }), seasonMonths: [10, 11, 12, 1, 2], storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 14 },
  { id: "fm-cabbage", canonicalName: "キャベツ", aliases: [], category: "野菜", edibleUnit: "枚", gramsPerUnit: 50, nutrition: n(23, 1.3, 0.2, 5.2, 1.8, 0, 43, 0.3, { vitaminC: 41 }), seasonMonths: [1, 2, 3, 4], storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 7 },
  { id: "fm-spinach", canonicalName: "ほうれん草", aliases: ["ホウレンソウ"], category: "野菜", edibleUnit: "束", gramsPerUnit: 200, nutrition: n(20, 2.2, 0.4, 3.1, 2.8, 0, 49, 2, { vitaminA: 350, vitaminC: 35 }), seasonMonths: [11, 12, 1, 2], storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 3 },
  { id: "fm-broccoli", canonicalName: "ブロッコリー", aliases: [], category: "野菜", edibleUnit: "株", gramsPerUnit: 200, nutrition: n(33, 4.3, 0.5, 5.2, 4.4, 0, 38, 1, { vitaminC: 120 }), seasonMonths: [11, 12, 1, 2, 3], storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 4 },
  { id: "fm-tomato", canonicalName: "トマト", aliases: [], category: "野菜", edibleUnit: "個", gramsPerUnit: 150, nutrition: n(19, 0.7, 0.1, 4.7, 1, 0, 7, 0.2, { vitaminC: 15 }), seasonMonths: [6, 7, 8], storageType: "refrigerated", freezable: "not_recommended", recommendedShelfLifeDays: 5, diabetesFriendly: true },
  { id: "fm-cucumber", canonicalName: "きゅうり", aliases: ["キュウリ"], category: "野菜", edibleUnit: "本", gramsPerUnit: 100, nutrition: n(14, 1, 0.1, 3, 1.1, 0, 26, 0.3, { vitaminC: 14 }), seasonMonths: [6, 7, 8], storageType: "refrigerated", freezable: "not_recommended", recommendedShelfLifeDays: 5 },
  { id: "fm-lettuce", canonicalName: "レタス", aliases: [], category: "野菜", edibleUnit: "枚", gramsPerUnit: 30, nutrition: n(12, 0.6, 0.1, 2.8, 1.1, 0, 19, 0.3, { vitaminC: 5 }), seasonMonths: [4, 5, 6], storageType: "refrigerated", freezable: "not_recommended", recommendedShelfLifeDays: 4 },
  { id: "fm-daikon", canonicalName: "大根", aliases: ["だいこん"], category: "野菜", edibleUnit: "本", gramsPerUnit: 300, nutrition: n(18, 0.5, 0.1, 4.1, 1.4, 0, 24, 0.2, { vitaminC: 12 }), seasonMonths: [11, 12, 1, 2], storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 10 },
  { id: "fm-eggplant", canonicalName: "なす", aliases: ["ナス", "茄子"], category: "野菜", edibleUnit: "本", gramsPerUnit: 80, nutrition: n(22, 1.1, 0.1, 5.1, 2.2, 0, 18, 0.3), seasonMonths: [6, 7, 8, 9], storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 5 },
  { id: "fm-pepper", canonicalName: "ピーマン", aliases: [], category: "野菜", edibleUnit: "個", gramsPerUnit: 40, nutrition: n(22, 0.9, 0.2, 5.1, 2.3, 0, 11, 0.4, { vitaminC: 76 }), seasonMonths: [6, 7, 8, 9], storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 5 },
  { id: "fm-bean-sprout", canonicalName: "もやし", aliases: [], category: "野菜", edibleUnit: "袋", gramsPerUnit: 200, nutrition: n(14, 1.7, 0.1, 2.6, 1.3, 0, 9, 0.3), storageType: "refrigerated", freezable: "not_recommended", recommendedShelfLifeDays: 2 },
  { id: "fm-garlic", canonicalName: "にんにく", aliases: ["ニンニク"], category: "野菜", edibleUnit: "片", gramsPerUnit: 5, nutrition: n(136, 6.4, 0.8, 28, 5.7, 0, 14, 0.8), storageType: "room_temperature", freezable: "possible", recommendedShelfLifeDays: 30 },
  { id: "fm-ginger", canonicalName: "生姜", aliases: ["しょうが", "ショウガ"], category: "野菜", edibleUnit: "片", gramsPerUnit: 10, nutrition: n(30, 0.9, 0.3, 6.6, 2, 0, 17, 0.5), storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 21 },
  { id: "fm-green-onion", canonicalName: "ねぎ", aliases: ["長ねぎ", "青ねぎ", "ネギ"], category: "野菜", edibleUnit: "本", gramsPerUnit: 100, nutrition: n(28, 1.2, 0.1, 6.5, 2.3, 0, 36, 0.2, { vitaminC: 11 }), storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 7 },
  { id: "fm-shiitake", canonicalName: "しいたけ", aliases: ["椎茸"], category: "きのこ", edibleUnit: "枚", gramsPerUnit: 20, nutrition: n(18, 3, 0.4, 4.9, 4.2, 0, 1, 0.3), storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 5 },
  { id: "fm-shimeji", canonicalName: "しめじ", aliases: [], category: "きのこ", edibleUnit: "パック", gramsPerUnit: 100, nutrition: n(18, 2.7, 0.3, 4.9, 3.7, 0, 1, 0.5), storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 5 },
  { id: "fm-enoki", canonicalName: "えのき", aliases: ["えのきたけ"], category: "きのこ", edibleUnit: "袋", gramsPerUnit: 100, nutrition: n(22, 2.7, 0.2, 7.6, 3.9, 0, 1, 0.9), storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 5 },
  { id: "fm-wakame", canonicalName: "わかめ", aliases: ["若布"], category: "海藻", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(16, 1.9, 0.2, 5.6, 2.7, 1.5, 100, 0.9), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 365 },
  { id: "fm-nori", canonicalName: "のり", aliases: ["海苔"], category: "海藻", edibleUnit: "枚", gramsPerUnit: 3, nutrition: n(188, 41.4, 3.7, 41.6, 36, 1.4, 160, 9), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 180 },
  { id: "fm-chicken-thigh", canonicalName: "鶏もも肉", aliases: ["鶏モモ肉", "とりもも", "鶏肉", "鶏もも"], category: "肉類", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(204, 16.2, 14.4, 0, 0, 0.1, 5, 0.6), storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 2, substituteFoods: ["fm-chicken-breast"], typicalCookingMethods: ["焼く", "煮る", "揚げる"] },
  { id: "fm-chicken-breast", canonicalName: "鶏むね肉", aliases: ["鶏胸肉", "ささみ", "鶏むね"], category: "肉類", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(108, 22.3, 1.5, 0, 0, 0.1, 4, 0.3), storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 2, substituteFoods: ["fm-chicken-thigh"], diabetesFriendly: true, typicalCookingMethods: ["焼く", "煮る"] },
  { id: "fm-pork-belly", canonicalName: "豚バラ肉", aliases: ["豚ばら肉", "豚肉"], category: "肉類", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(386, 14.2, 35.4, 0.1, 0, 0.1, 4, 0.5), storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 2, substituteFoods: ["fm-pork-koma"] },
  { id: "fm-pork-koma", canonicalName: "豚こま切れ", aliases: ["豚こま", "豚小間", "国産豚小間切落し", "豚コマ", "豚肉こま切れ", "豚小間切れ"], category: "肉類", subcategory: "豚肉", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(225, 17.5, 16.5, 0.1, 0, 0.1, 4, 0.6), storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 2, substituteFoods: ["fm-pork-loin", "fm-minced-meat"], commonPackageSizes: ["100g", "200g", "300g"], typicalCookingMethods: ["炒める", "煮る"] },
  { id: "fm-pork-loin", canonicalName: "豚ロース", aliases: ["豚ロース肉"], category: "肉類", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(263, 17.1, 19.2, 0.1, 0, 0.1, 4, 0.4), storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 2, substituteFoods: ["fm-pork-koma"] },
  { id: "fm-beef", canonicalName: "牛肉", aliases: ["牛こま肉", "牛薄切り"], category: "肉類", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(259, 17.2, 19.5, 0.2, 0, 0.1, 4, 1.5), storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 2 },
  { id: "fm-minced-meat", canonicalName: "合挽き肉", aliases: ["ひき肉", "挽肉"], category: "肉類", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(221, 17, 16, 0.3, 0, 0.1, 5, 1.2), storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 2, substituteFoods: ["fm-pork-koma"] },
  { id: "fm-salmon", canonicalName: "鮭", aliases: ["サケ", "しゃけ", "サーモン"], category: "魚介類", edibleUnit: "切れ", gramsPerUnit: 80, nutrition: n(133, 22.3, 4.1, 0.1, 0, 0.1, 14, 0.5), seasonMonths: [9, 10, 11], storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 2 },
  { id: "fm-mackerel", canonicalName: "さば", aliases: ["サバ", "鯖"], category: "魚介類", edibleUnit: "切れ", gramsPerUnit: 100, nutrition: n(202, 20.7, 12, 0.1, 0, 0.2, 8, 1), seasonMonths: [9, 10, 11], storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 2 },
  { id: "fm-tuna", canonicalName: "まぐろ", aliases: ["マグロ", "ツナ"], category: "魚介類", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(125, 26.4, 1.4, 0.1, 0, 0.1, 5, 1.1), storageType: "refrigerated", freezable: "recommended", recommendedShelfLifeDays: 1 },
  { id: "fm-shrimp", canonicalName: "えび", aliases: ["エビ", "海老"], category: "魚介類", edibleUnit: "尾", gramsPerUnit: 15, nutrition: n(82, 18.5, 0.3, 0.1, 0, 0.4, 50, 0.2), storageType: "frozen", freezable: "recommended", recommendedShelfLifeDays: 2 },
  { id: "fm-crab", canonicalName: "かに", aliases: ["カニ", "蟹"], category: "魚介類", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(68, 15.1, 0.4, 0.1, 0, 0.7, 60, 0.4), storageType: "frozen", freezable: "recommended", recommendedShelfLifeDays: 2 },
  { id: "fm-egg", canonicalName: "卵", aliases: ["たまご", "玉子", "鶏卵"], category: "卵", edibleUnit: "個", gramsPerUnit: 60, nutrition: n(151, 12.3, 10.3, 0.3, 0, 0.4, 51, 1.8), storageType: "refrigerated", freezable: "not_recommended", recommendedShelfLifeDays: 14 },
  { id: "fm-milk", canonicalName: "牛乳", aliases: ["ミルク"], category: "乳製品", edibleUnit: "ml", gramsPerUnit: 1, nutrition: n(67, 3.3, 3.8, 4.8, 0, 0.1, 110, 0), storageType: "refrigerated", freezable: "not_recommended", recommendedShelfLifeDays: 7 },
  { id: "fm-butter", canonicalName: "バター", aliases: [], category: "乳製品", edibleUnit: "g", gramsPerUnit: 1, gramsPerTablespoon: 12, nutrition: n(745, 0.6, 81, 0.2, 0, 0.5, 15, 0), storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 30 },
  { id: "fm-cheese", canonicalName: "チーズ", aliases: ["プロセスチーズ"], category: "乳製品", edibleUnit: "枚", gramsPerUnit: 20, nutrition: n(340, 22.7, 26, 1.3, 0, 2.8, 630, 0.2), storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 21 },
  { id: "fm-tofu", canonicalName: "豆腐", aliases: ["木綿豆腐", "絹豆腐"], category: "豆類", edibleUnit: "丁", gramsPerUnit: 300, nutrition: n(56, 6.6, 3.4, 1.6, 0.4, 0, 86, 0.9), storageType: "refrigerated", freezable: "not_recommended", recommendedShelfLifeDays: 5, diabetesFriendly: true },
  { id: "fm-natto", canonicalName: "納豆", aliases: [], category: "豆類", edibleUnit: "パック", gramsPerUnit: 50, nutrition: n(200, 16.5, 10, 12.1, 6.7, 0, 90, 3.3), storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 7, diabetesFriendly: true },
  { id: "fm-soy-milk", canonicalName: "豆乳", aliases: [], category: "豆類", edibleUnit: "ml", gramsPerUnit: 1, nutrition: n(46, 3.6, 2, 3.1, 0.2, 0, 15, 1.2), storageType: "refrigerated", freezable: "not_recommended", recommendedShelfLifeDays: 7 },
  { id: "fm-aburaage", canonicalName: "油揚げ", aliases: ["厚揚げ"], category: "豆類", edibleUnit: "枚", gramsPerUnit: 20, nutrition: n(386, 18.6, 33.1, 0.5, 0.8, 0, 150, 2.5), storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 5 },
  { id: "fm-apple", canonicalName: "りんご", aliases: ["リンゴ"], category: "果物", edibleUnit: "個", gramsPerUnit: 200, nutrition: n(61, 0.2, 0.1, 16.2, 1.9, 0, 3, 0, { vitaminC: 4 }), seasonMonths: [9, 10, 11], storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 14 },
  { id: "fm-banana", canonicalName: "バナナ", aliases: [], category: "果物", edibleUnit: "本", gramsPerUnit: 100, nutrition: n(86, 1.1, 0.2, 22.5, 1.1, 0, 6, 0.3, { vitaminC: 16 }), storageType: "room_temperature", freezable: "possible", recommendedShelfLifeDays: 5, glycemicCategory: "medium" },
  { id: "fm-oil", canonicalName: "サラダ油", aliases: ["食用油", "植物油", "油"], category: "油脂", edibleUnit: "大さじ", gramsPerUnit: 12, gramsPerTablespoon: 12, gramsPerTeaspoon: 4, nutrition: n(921, 0, 100, 0, 0, 0, 0, 0), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 180 },
  { id: "fm-sesame-oil", canonicalName: "ごま油", aliases: [], category: "油脂", edibleUnit: "大さじ", gramsPerUnit: 12, gramsPerTablespoon: 12, nutrition: n(921, 0, 100, 0, 0, 0, 0, 0), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 180 },
  { id: "fm-soy-sauce", canonicalName: "しょうゆ", aliases: ["醤油", "こいくちしょうゆ"], category: "調味料", edibleUnit: "大さじ", gramsPerUnit: 18, gramsPerTablespoon: 18, gramsPerTeaspoon: 6, nutrition: n(71, 7.7, 0, 7.9, 0, 14.5, 22, 1.7), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 365 },
  { id: "fm-miso", canonicalName: "味噌", aliases: ["みそ"], category: "調味料", edibleUnit: "大さじ", gramsPerUnit: 18, gramsPerTablespoon: 18, nutrition: n(192, 12.5, 6, 23, 4.9, 12, 90, 3.5), storageType: "refrigerated", freezable: "not_recommended", recommendedShelfLifeDays: 180 },
  { id: "fm-salt", canonicalName: "塩", aliases: ["食塩"], category: "調味料", edibleUnit: "g", gramsPerUnit: 1, gramsPerTeaspoon: 6, nutrition: n(0, 0, 0, 0, 0, 99, 0, 0), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 1825 },
  { id: "fm-sugar", canonicalName: "砂糖", aliases: ["上白糖"], category: "調味料", edibleUnit: "g", gramsPerUnit: 1, gramsPerTablespoon: 9, nutrition: n(387, 0, 0, 100, 0, 0, 1, 0), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 730, glycemicCategory: "high" },
  { id: "fm-mirin", canonicalName: "みりん", aliases: ["本みりん"], category: "調味料", edibleUnit: "大さじ", gramsPerUnit: 18, gramsPerTablespoon: 18, nutrition: n(241, 0.1, 0, 43.2, 0, 0, 2, 0), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 365 },
  { id: "fm-sake", canonicalName: "酒", aliases: ["料理酒"], category: "調味料", edibleUnit: "大さじ", gramsPerUnit: 15, gramsPerTablespoon: 15, nutrition: n(109, 0.3, 0, 4.9, 0, 0, 1, 0), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 365 },
  { id: "fm-vinegar", canonicalName: "酢", aliases: ["米酢"], category: "調味料", edibleUnit: "大さじ", gramsPerUnit: 15, gramsPerTablespoon: 15, nutrition: n(25, 0.1, 0, 2.4, 0, 0, 2, 0), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 730 },
  { id: "fm-mayo", canonicalName: "マヨネーズ", aliases: ["マヨ"], category: "調味料", edibleUnit: "大さじ", gramsPerUnit: 12, gramsPerTablespoon: 12, nutrition: n(703, 1.4, 75.5, 3.6, 0, 1.8, 7, 0.2), storageType: "refrigerated", freezable: "not_recommended", recommendedShelfLifeDays: 60 },
  { id: "fm-ketchup", canonicalName: "ケチャップ", aliases: [], category: "調味料", edibleUnit: "大さじ", gramsPerUnit: 15, gramsPerTablespoon: 15, nutrition: n(119, 1.7, 0.1, 28, 1.5, 2.5, 12, 0.5), storageType: "refrigerated", freezable: "not_recommended", recommendedShelfLifeDays: 60 },
  { id: "fm-curry-roux", canonicalName: "カレールウ", aliases: ["カレー粉"], category: "加工食品", edibleUnit: "箱", gramsPerUnit: 100, nutrition: n(500, 6, 30, 50, 2, 5, 40, 2), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 365 },
  { id: "fm-dashi", canonicalName: "だしの素", aliases: ["顆粒だし", "和風だし"], category: "調味料", edibleUnit: "小さじ", gramsPerUnit: 3, gramsPerTeaspoon: 3, nutrition: n(280, 20, 2, 40, 0, 40, 50, 1), storageType: "room_temperature", freezable: "not_recommended", recommendedShelfLifeDays: 365 },
  { id: "fm-peanut", canonicalName: "落花生", aliases: ["ピーナッツ"], category: "豆類", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(562, 25.4, 47.5, 18.8, 7.4, 0, 50, 1.6), storageType: "room_temperature", freezable: "possible", recommendedShelfLifeDays: 90 },
  { id: "fm-walnut", canonicalName: "くるみ", aliases: ["クルミ"], category: "豆類", edibleUnit: "g", gramsPerUnit: 1, nutrition: n(674, 14.6, 68.8, 11.7, 7.2, 0, 85, 2.6), storageType: "room_temperature", freezable: "possible", recommendedShelfLifeDays: 90 },
  { id: "fm-konnyaku", canonicalName: "こんにゃく", aliases: [], category: "その他", edibleUnit: "枚", gramsPerUnit: 200, nutrition: n(5, 0.1, 0, 2.3, 2.2, 0, 7, 0.1), storageType: "refrigerated", freezable: "not_recommended", recommendedShelfLifeDays: 14, diabetesFriendly: true },
  { id: "fm-ham", canonicalName: "ハム", aliases: [], category: "加工食品", edibleUnit: "枚", gramsPerUnit: 15, nutrition: n(196, 16.5, 13, 1.3, 0, 2.2, 6, 0.6), storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 7 },
  { id: "fm-bacon", canonicalName: "ベーコン", aliases: [], category: "加工食品", edibleUnit: "枚", gramsPerUnit: 20, nutrition: n(405, 12.9, 39.1, 0.3, 0, 1.7, 5, 0.5), storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 7 },
  { id: "fm-sausage", canonicalName: "ソーセージ", aliases: ["ウインナー"], category: "加工食品", edibleUnit: "本", gramsPerUnit: 20, nutrition: n(321, 13.2, 28.5, 3, 0, 1.9, 12, 0.8), storageType: "refrigerated", freezable: "possible", recommendedShelfLifeDays: 7 },
];

export const FOOD_MASTER_SOURCE = "meal-planner-sample";
export const FOOD_MASTER_SOURCE_VERSION = "v2";

export function createSampleFoodMasters(
  now: string = new Date().toISOString(),
): FoodIngredientMaster[] {
  return DRAFTS.map((draft) => {
    const migrated = migrateFoodMaster({
      id: draft.id,
      foodCode: draft.id,
      canonicalName: draft.canonicalName,
      aliases: draft.aliases ?? [],
      category: draft.category,
      subcategory: draft.subcategory ?? null,
      defaultUnit: draft.edibleUnit ?? "g",
      edibleUnit: draft.edibleUnit ?? "g",
      gramsPerUnit: draft.gramsPerUnit ?? null,
      gramsPerTablespoon: draft.gramsPerTablespoon ?? null,
      gramsPerTeaspoon: draft.gramsPerTeaspoon ?? null,
      density: null,
      nutritionPer100g: draft.nutrition,
      nutritionReference: {
        provider: "embedded",
        foodCode: null,
        note: null,
      },
      seasonMonths: draft.seasonMonths ?? [],
      storageType: draft.storageType ?? null,
      freezable: draft.freezable ?? null,
      recommendedShelfLifeDays: draft.recommendedShelfLifeDays ?? null,
      glycemicCategory: draft.glycemicCategory ?? "unknown",
      diabetesFriendly: draft.diabetesFriendly ?? null,
      commonPackageSizes: draft.commonPackageSizes ?? [],
      commonStores: [],
      typicalCookingMethods: draft.typicalCookingMethods ?? [],
      substituteFoods: draft.substituteFoods ?? [],
      pantryType: draft.pantryType ?? null,
      source: FOOD_MASTER_SOURCE,
      sourceVersion: FOOD_MASTER_SOURCE_VERSION,
      createdAt: now,
      updatedAt: now,
    });
    if (!migrated) {
      throw new Error(`sample food master failed: ${draft.id}`);
    }
    return migrated;
  });
}

export const SAMPLE_FOOD_MASTER_COUNT = DRAFTS.length;
