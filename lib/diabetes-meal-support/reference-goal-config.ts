/**
 * 参考目標ウィザードの計算係数。
 * UI に埋め込まず、ここだけで調整できるようにする。
 * 医学的な唯一の正解ではなく、献立用の参考算出用。
 */

export const REFERENCE_GOAL_CONFIG = {
  /** 参考体重に用いる BMI（日本でよく使われる目安） */
  referenceBmi: 22,

  bmiThresholds: {
    underweightMax: 18.5,
    normalMax: 25,
    overweightMax: 30,
  },

  /** Mifflin-St Jeor 風の係数（参考用） */
  bmr: {
    weightKg: 10,
    heightCm: 6.25,
    age: 5,
    maleOffset: 5,
    femaleOffset: -161,
    unspecifiedOffset: -78,
  },

  activityFactors: {
    low: 1.2,
    moderate: 1.375,
    high: 1.55,
  } as const,

  /** エネルギー範囲の幅（中央値からの%） */
  calorieRangePercent: 0.1,

  /** ゆっくり減量時のカロリー調整（kcal、範囲の両端に適用） */
  gradualLossCalorieDelta: {
    min: -300,
    max: -200,
  },

  /**
   * 炭水化物エネルギー比率の参考範囲。
   * 極端な低糖質・ケトは含めない。
   */
  carbEnergyRatio: {
    balanced: { min: 0.5, max: 0.55 },
    moderatelyLowerCarb: { min: 0.4, max: 0.45 },
  },

  /** 炭水化物 1g = 4 kcal */
  kcalPerGramCarb: 4,

  /** 炊飯ごはん 100g あたり糖質の概算（参考） */
  cookedRiceCarbsPer100g: 37,

  /**
   * 食事配分（合計 1.0）。
   * threeMealsWithSnacks は 3 食 + 間食。
   */
  mealDistribution: {
    twoMeals: { meal: 0.5, snack: 0, mealCount: 2 },
    threeMeals: { meal: 1 / 3, snack: 0, mealCount: 3 },
    threeMealsWithSnacks: { meal: 0.28, snack: 0.16, mealCount: 3 },
    irregular: { meal: 1 / 3, snack: 0, mealCount: 3 },
  } as const,

  /** 入力妥当性 */
  validation: {
    heightCm: { min: 100, max: 250 },
    weightKg: { min: 20, max: 300 },
    age: { min: 18, max: 120 },
    targetWeightKg: { min: 20, max: 300 },
    clinicianCarbs: { min: 0, max: 500 },
  },

  disclaimers: {
    referenceOnly:
      "この数値は献立作成に利用する参考値であり、診断や治療の指示ではありません。医師または管理栄養士から案内された数値がある場合は、その値を優先してください。",
    carbNotGlucose: "糖質量と食後血糖値は同じものではありません。",
    medicationWarning:
      "食事の糖質量を変更すると、薬やインスリンとのバランスに影響する場合があります。主治医または管理栄養士に確認してください。",
    specialCondition:
      "腎臓病・妊娠・18歳未満など、一般的な計算だけでは適切に扱えない条件が選ばれています。主治医または管理栄養士に個別にご相談ください。この結果は診断値としては保存できません。",
  },
} as const;

export type ReferenceGoalConfig = typeof REFERENCE_GOAL_CONFIG;
