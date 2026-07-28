import { describe, expect, it } from "vitest";
import { foodMasterFixture } from "@/lib/food-master/fixture";
import { migrateFoodMaster } from "@/lib/food-master/migrate";
import {
  formatSeasonMonths,
  getFoodFreezable,
  getFoodStorageType,
  isFoodInSeason,
  listSubstituteMasters,
  resolveFoodMaster,
} from "@/lib/food-master/resolve";
import { createSampleFoodMasters } from "@/lib/food-master/sample-data";
import { shoppingCategoryFromFoodCategory } from "@/lib/food-master/shopping-category";
import {
  FOOD_FREEZABLE_LABELS,
  FOOD_STORAGE_TYPE_LABELS,
} from "@/types/food-master";

describe("Food Master", () => {
  const masters = createSampleFoodMasters("2026-07-01T00:00:00.000Z");

  it("aliases resolve to canonical 豚こま切れ", () => {
    for (const alias of [
      "豚こま",
      "豚小間",
      "国産豚小間切落し",
      "豚こま切れ",
    ]) {
      const hit = resolveFoodMaster(alias, { masters });
      expect(hit.master?.id).toBe("fm-pork-koma");
      expect(hit.canonicalName).toBe("豚こま切れ");
      expect(hit.foodCode).toBe("fm-pork-koma");
      expect(hit.needsReview).toBe(false);
    }
  });

  it("has season / storage / freezable / shelf life for tomato", () => {
    const tomato = masters.find((item) => item.id === "fm-tomato");
    expect(tomato).toBeTruthy();
    expect(tomato?.seasonMonths).toEqual([6, 7, 8]);
    expect(isFoodInSeason(tomato ?? null, 7)).toBe(true);
    expect(isFoodInSeason(tomato ?? null, 1)).toBe(false);
    expect(formatSeasonMonths(tomato?.seasonMonths ?? [])).toBe("6〜8月");
    expect(getFoodStorageType(tomato ?? null)).toBe("refrigerated");
    expect(FOOD_STORAGE_TYPE_LABELS.refrigerated).toBe("冷蔵");
    expect(getFoodFreezable(tomato ?? null)).toBe("not_recommended");
    expect(FOOD_FREEZABLE_LABELS.not_recommended).toBe("不可");
    expect(tomato?.recommendedShelfLifeDays).toBe(5);
  });

  it("lists substitute foods 鶏もも → 鶏むね", () => {
    const thigh = masters.find((item) => item.id === "fm-chicken-thigh");
    const substitutes = listSubstituteMasters(thigh ?? null, masters);
    expect(substitutes.map((item) => item.id)).toContain("fm-chicken-breast");
    expect(substitutes[0]?.canonicalName).toBe("鶏むね肉");
  });

  it("migrates legacy master rows without losing name", () => {
    const legacy = {
      id: "fm-onion",
      canonicalName: "玉ねぎ",
      aliases: ["たまねぎ"],
      category: "野菜",
      edibleUnit: "個",
      gramsPerUnit: 200,
      nutritionPer100g: {
        calories: 37,
        protein: 1,
        fat: 0.1,
        carbohydrates: 8.8,
        fiber: 1.6,
        saltEquivalent: 0,
        calcium: 21,
        iron: 0.2,
      },
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    const migrated = migrateFoodMaster(legacy);
    expect(migrated).not.toBeNull();
    expect(migrated?.foodCode).toBe("fm-onion");
    expect(migrated?.defaultUnit).toBe("個");
    expect(migrated?.seasonMonths).toEqual([]);
    expect(migrated?.storageType).toBe("refrigerated");
    expect(migrated?.substituteFoods).toEqual([]);
    expect(migrated?.nutritionReference?.provider).toBe("embedded");
  });

  it("fixture helper fills required hub fields", () => {
    const master = foodMasterFixture({
      id: "fm-test",
      canonicalName: "テスト食材",
      category: "その他",
      seasonMonths: [1, 2],
      freezable: "possible",
    });
    expect(master.foodCode).toBe("fm-test");
    expect(master.aliases).toEqual([]);
    expect(master.commonPackageSizes).toEqual([]);
    expect(isFoodInSeason(master, 1)).toBe(true);
  });

  it("maps food category to shopping category", () => {
    expect(shoppingCategoryFromFoodCategory("肉類")).toBe("肉");
    expect(shoppingCategoryFromFoodCategory("野菜")).toBe("野菜");
    expect(shoppingCategoryFromFoodCategory("調味料")).toBe("調味料");
  });

  it("pork koma is freezable recommended with shelf life", () => {
    const pork = masters.find((item) => item.id === "fm-pork-koma");
    expect(pork?.freezable).toBe("recommended");
    expect(pork?.storageType).toBe("refrigerated");
    expect(pork?.recommendedShelfLifeDays).toBe(2);
    expect(pork?.substituteFoods).toContain("fm-pork-loin");
  });
});
