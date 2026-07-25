"use client";

import {
  COOKING_TIME_LIMITS,
  CONDITION_MODES,
  HEALTH_GOALS,
  type ConditionMode,
  type CookingTimeLimit,
  type HealthGoal,
  type HouseholdPreferences,
} from "@/types/meal-preferences";

type MealPlanPreferencesPanelProps = {
  preferences: HouseholdPreferences;
  onChange: (
    patch: Partial<Omit<HouseholdPreferences, "updatedAt">>,
  ) => void;
};

export function MealPlanPreferencesPanel({
  preferences,
  onChange,
}: MealPlanPreferencesPanelProps) {
  return (
    <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <h2 className="text-sm font-medium text-on-surface-variant">
        献立エンジン設定
      </h2>

      <label className="block space-y-1">
        <span className="text-xs text-on-surface-variant">人数</span>
        <input
          type="number"
          min={1}
          max={12}
          value={preferences.servingCount}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isInteger(value) && value >= 1) {
              onChange({ servingCount: value });
            }
          }}
          className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-on-surface-variant">健康目標</span>
        <select
          value={preferences.healthGoal}
          onChange={(event) => {
            onChange({ healthGoal: event.target.value as HealthGoal });
          }}
          className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
        >
          {HEALTH_GOALS.map((goal) => (
            <option key={goal} value={goal}>
              {goal}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-on-surface-variant">料理時間の上限</span>
        <select
          value={preferences.cookingTimeLimit}
          onChange={(event) => {
            onChange({
              cookingTimeLimit: Number(event.target.value) as CookingTimeLimit,
            });
          }}
          className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
        >
          {COOKING_TIME_LIMITS.map((limit) => (
            <option key={limit} value={limit}>
              {limit}分
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-on-surface-variant">今日の体調</span>
        <select
          value={preferences.conditionMode}
          onChange={(event) => {
            onChange({ conditionMode: event.target.value as ConditionMode });
          }}
          className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
        >
          {CONDITION_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>

      <p className="text-xs text-on-surface-variant">
        栄養・季節・在庫・好みをルールで採点して自動献立します（AI 未使用）。
      </p>
    </section>
  );
}
