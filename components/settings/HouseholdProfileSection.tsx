"use client";

import Link from "next/link";
import { useState } from "react";
import { DiabetesHealthSection } from "@/components/settings/DiabetesMealSupportSettingsPage";
import { ProfileAccordion } from "@/components/settings/ProfileAccordion";
import { useHouseholdPreferences } from "@/lib/use-meal-preferences";
import {
  COOKING_TIME_LIMITS,
  HEALTH_GOALS,
  type CookingTimeLimit,
  type HealthGoal,
} from "@/types/meal-preferences";

/**
 * 家庭全体の設定（人数・献立方針・健康方針・買い物先）。
 */
export function HouseholdProfileSection() {
  const { preferences, save } = useHouseholdPreferences();
  const [openId, setOpenId] = useState<string | null>("servings");
  const [message, setMessage] = useState<string | null>(null);

  function toggle(id: string): void {
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">家庭全体</h2>
        <p className="mt-0.5 text-xs text-on-surface-variant">
          家族共通の人数・方針・健康サポート
        </p>
      </div>

      <ProfileAccordion
        title="通常の食事人数"
        summary={`${preferences.defaultMealServings}人分`}
        open={openId === "servings"}
        onToggle={() => toggle("servings")}
      >
        <label className="block space-y-1">
          <span className="text-xs text-on-surface-variant">人数</span>
          <input
            type="number"
            min={1}
            max={20}
            value={preferences.defaultMealServings}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= 1) {
                save({ defaultMealServings: value });
                setMessage("人数を保存しました");
              }
            }}
            className="w-full rounded-xl bg-surface-container px-3 py-2.5 text-sm"
          />
          <p className="text-[11px] text-on-surface-variant">
            来客や不在がない日の人数です。日ごとの変更は献立画面から行えます。
          </p>
        </label>
      </ProfileAccordion>

      <ProfileAccordion
        title="献立方針"
        summary={`${preferences.healthGoal} · ${preferences.cookingTimeLimit}分`}
        open={openId === "policy"}
        onToggle={() => toggle("policy")}
      >
        <label className="block space-y-1">
          <span className="text-xs text-on-surface-variant">健康方針</span>
          <select
            value={preferences.healthGoal}
            onChange={(event) => {
              save({ healthGoal: event.target.value as HealthGoal });
              setMessage("献立方針を保存しました");
            }}
            className="w-full rounded-xl bg-surface-container px-3 py-2.5 text-sm"
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
              save({
                cookingTimeLimit: Number(event.target.value) as CookingTimeLimit,
              });
              setMessage("献立方針を保存しました");
            }}
            className="w-full rounded-xl bg-surface-container px-3 py-2.5 text-sm"
          >
            {COOKING_TIME_LIMITS.map((limit) => (
              <option key={limit} value={limit}>
                {limit}分
              </option>
            ))}
          </select>
        </label>
      </ProfileAccordion>

      <ProfileAccordion
        title="健康方針（家庭）"
        summary="糖尿病・体重管理サポート"
        open={openId === "health"}
        onToggle={() => toggle("health")}
      >
        <DiabetesHealthSection embedded />
      </ProfileAccordion>

      <ProfileAccordion
        title="よく買い物する店"
        summary="買い物先・食費予算"
        open={openId === "store"}
        onToggle={() => toggle("store")}
      >
        <p className="text-sm text-on-surface-variant">
          よく行く店や週間予算は専用画面で管理します。
        </p>
        <Link
          href="/settings/store-budget"
          className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
        >
          買い物先・食費予算を開く
        </Link>
      </ProfileAccordion>

      {message ? (
        <p className="text-sm text-on-surface-variant" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
