import { describe, expect, it } from "vitest";
import {
  estimateStandardNutrition,
  migrateHealthFlagsFromGoals,
  packProfileNotes,
  unpackProfileNotes,
  collectFamilyLearningHints,
} from "@/lib/family-profile-helpers";
import { migrateProfile } from "@/lib/family-member-profiles";

describe("family profile migration", () => {
  it("旧プロフィールを新フィールド付きへ移行する", () => {
    const migrated = migrateProfile({
      id: "p1",
      householdId: "local",
      displayName: "ママ",
      ageGroup: "成人",
      activityLevel: "普通",
      sex: "女性",
      birthYear: 1985,
      calorieTarget: 1800,
      proteinTarget: 60,
      saltLimit: 6,
      goals: ["減量", "減塩"],
      allergies: ["卵"],
      dislikedIngredients: ["しいたけ"],
      dietaryRestrictions: ["なし"],
      notes: "朝は少なめ",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(migrated).not.toBeNull();
    expect(migrated!.servingPortion).toBe("普通");
    // 旧データにカロリー目標がある場合は手動扱い（値を消さない）
    expect(migrated!.useStandardNutrition).toBe(false);
    expect(migrated!.calorieTarget).toBe(1800);
    expect(migrated!.healthFlags).toContain("dieting");
    expect(migrated!.healthFlags).toContain("low_salt");
    expect(migrated!.notes).toBe("朝は少なめ");
    expect(migrated!.age).toBeGreaterThan(30);
  });

  it("notes 内の拡張フィールドを往復できる", () => {
    const packed = packProfileNotes("娘はチーズ好き", {
      age: 10,
      servingPortion: "少なめ",
      useStandardNutrition: false,
      fatTarget: 40,
      carbTarget: 180,
      healthFlags: ["dieting"],
      likedIngredients: ["チーズ"],
      foodPreferences: ["和食"],
      cookingDays: ["monday", "wednesday"],
      healthNotes: "減量中",
    });
    const unpacked = unpackProfileNotes(packed);
    expect(unpacked.notes).toBe("娘はチーズ好き");
    expect(unpacked.extra.age).toBe(10);
    expect(unpacked.extra.likedIngredients).toEqual(["チーズ"]);
    expect(unpacked.extra.cookingDays).toEqual(["monday", "wednesday"]);
  });
});

describe("estimateStandardNutrition", () => {
  it("標準設定でカロリーを返す", () => {
    const result = estimateStandardNutrition({
      age: 40,
      sex: "女性",
      activityLevel: "普通",
      servingPortion: "普通",
    });
    expect(result.calorieTarget).toBeGreaterThan(1200);
    expect(result.proteinTarget).toBeGreaterThan(0);
    expect(result.fatTarget).toBeGreaterThan(0);
    expect(result.carbTarget).toBeGreaterThan(0);
  });
});

describe("collectFamilyLearningHints", () => {
  it("アクティブメンバーの好みを集約する", () => {
    const hints = collectFamilyLearningHints([
      {
        id: "1",
        householdId: "local",
        displayName: "父",
        age: 42,
        birthYear: null,
        ageGroup: "成人",
        sex: "男性",
        activityLevel: "普通",
        servingPortion: "普通",
        calorieTarget: 2200,
        proteinTarget: 80,
        fatTarget: 60,
        carbTarget: 280,
        saltLimit: null,
        useStandardNutrition: true,
        goals: [],
        healthFlags: ["high_protein"],
        allergies: [],
        dislikedIngredients: ["セロリ"],
        likedIngredients: ["豚肉"],
        dietaryRestrictions: ["なし"],
        foodPreferences: ["肉料理"],
        cookingDays: ["tuesday"],
        notes: "辛いもの苦手",
        healthNotes: null,
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    expect(hints.likedIngredients).toContain("豚肉");
    expect(hints.foodPreferences).toContain("肉料理");
    expect(hints.aiNotes[0]).toContain("辛いもの苦手");
  });
});

describe("migrateHealthFlagsFromGoals", () => {
  it("goals から健康フラグを補完する", () => {
    expect(migrateHealthFlagsFromGoals(["高たんぱく", "減塩"])).toEqual(
      expect.arrayContaining(["high_protein", "low_salt"]),
    );
  });
});
