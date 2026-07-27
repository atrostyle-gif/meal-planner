"use client";

import type { AutoNutritionPreview } from "@/lib/nutrition/recipe-auto-estimate";
import type { ProteinType, RecipeSeason } from "@/types/recipe";
import { PROTEIN_TYPES, RECIPE_SEASONS } from "@/types/recipe";

type RecipeNutritionAutoSectionProps = {
  preview: AutoNutritionPreview | null;
  calculating: boolean;
  showManual: boolean;
  onRecalculate: () => void;
  onToggleManual: () => void;
  caloriesText: string;
  proteinText: string;
  fatText: string;
  carbsText: string;
  saltText: string;
  vegetablesText: string;
  setCaloriesText: (value: string) => void;
  setProteinText: (value: string) => void;
  setFatText: (value: string) => void;
  setCarbsText: (value: string) => void;
  setSaltText: (value: string) => void;
  setVegetablesText: (value: string) => void;
  proteinType: ProteinType | "";
  season: RecipeSeason | "";
  setProteinType: (value: ProteinType | "") => void;
  setSeason: (value: RecipeSeason | "") => void;
};

function formatValue(value: number | null, unit: string): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const rounded =
    Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${unit}`;
}

/** 通常は自動計算の要約のみ。手動入力は「手動で修正」で展開 */
export function RecipeNutritionAutoSection({
  preview,
  calculating,
  showManual,
  onRecalculate,
  onToggleManual,
  caloriesText,
  proteinText,
  fatText,
  carbsText,
  saltText,
  vegetablesText,
  setCaloriesText,
  setProteinText,
  setFatText,
  setCarbsText,
  setSaltText,
  setVegetablesText,
  proteinType,
  season,
  setProteinType,
  setSeason,
}: RecipeNutritionAutoSectionProps) {
  return (
    <fieldset className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <legend className="px-1 text-sm font-medium">栄養</legend>

      <div className="space-y-2">
        <p className="text-sm font-semibold">AI自動計算</p>

        {calculating ? (
          <p className="text-sm text-on-surface-variant" role="status">
            計算中…
          </p>
        ) : preview == null || preview.totalCount === 0 ? (
          <p className="text-sm text-on-surface-variant">
            材料を入れると表示されます
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p>
              <span className="text-on-surface-variant">カロリー </span>
              <span className="font-semibold">
                {formatValue(preview.caloriesKcal, "kcal")}
              </span>
            </p>
            <p>
              <span className="text-on-surface-variant">糖質 </span>
              <span className="font-semibold">
                {formatValue(preview.carbohydratesG, "g")}
              </span>
            </p>
            <p>
              <span className="text-on-surface-variant">🥕 野菜 </span>
              <span className="font-semibold">
                {formatValue(preview.vegetablesG, "g")}
              </span>
            </p>
            <p>
              <span className="text-on-surface-variant">カバー率 </span>
              <span className="font-semibold">
                {Math.round(preview.nutritionCoverage)}%
              </span>
            </p>
          </div>
        )}

        {preview && preview.totalCount > 0 && preview.matchedCount === 0 ? (
          <p className="text-xs text-on-surface-variant">
            栄養情報が不足しています
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRecalculate}
          disabled={calculating}
          className="flex-1 rounded-xl bg-secondary-container px-3 py-2.5 text-sm font-semibold text-on-secondary-container disabled:opacity-60"
        >
          再計算
        </button>
        <button
          type="button"
          onClick={onToggleManual}
          className="flex-1 rounded-xl px-3 py-2.5 text-sm font-medium ring-1 ring-outline-variant"
        >
          {showManual ? "閉じる" : "手動で修正"}
        </button>
      </div>

      {showManual ? (
        <div className="space-y-3 border-t border-outline-variant pt-3">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["カロリー", caloriesText, setCaloriesText, "kcal"],
                ["たんぱく質", proteinText, setProteinText, "g"],
                ["脂質", fatText, setFatText, "g"],
                ["炭水化物", carbsText, setCarbsText, "g"],
                ["塩分", saltText, setSaltText, "g"],
                ["野菜量", vegetablesText, setVegetablesText, "g"],
              ] as const
            ).map(([label, value, setter, unit]) => (
              <label key={label} className="block space-y-1">
                <span className="text-xs text-on-surface-variant">
                  {label}（{unit}）
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={value}
                  onChange={(event) => setter(event.target.value)}
                  className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                  placeholder="—"
                />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-on-surface-variant">たんぱく源</span>
              <select
                value={proteinType}
                onChange={(event) =>
                  setProteinType(event.target.value as ProteinType | "")
                }
                className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
              >
                <option value="">未設定</option>
                {PROTEIN_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-on-surface-variant">季節</span>
              <select
                value={season}
                onChange={(event) =>
                  setSeason(event.target.value as RecipeSeason | "")
                }
                className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
              >
                <option value="">未設定</option>
                {RECIPE_SEASONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
