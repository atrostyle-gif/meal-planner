"use client";

import Link from "next/link";
import { DayServingsEditor } from "@/components/meals/DayServingsEditor";
import { MealReasonPanel } from "@/components/meals/MealReasonPanel";
import type {
  TodayDecisionReasons,
  TodayDish,
  TodayPrimaryCook,
} from "@/lib/today/dashboard";

type TodayDinnerCardProps = {
  dishes: TodayDish[];
  servings: number | null;
  servingsIsCustom: boolean;
  defaultMealServings: number;
  cookingTimeMinutes: number | null;
  primaryCook: TodayPrimaryCook | null;
  decisionReasons?: TodayDecisionReasons | null;
  onChangeServings: (servings: number) => void;
  onResetServings: () => void;
};

/** ホーム中心の「今日の夕食」カード */
export function TodayDinnerCard({
  dishes,
  servings,
  servingsIsCustom,
  defaultMealServings,
  cookingTimeMinutes,
  primaryCook,
  decisionReasons,
  onChangeServings,
  onResetServings,
}: TodayDinnerCardProps) {
  if (dishes.length === 0) {
    return (
      <section className="rounded-2xl bg-surface-container-lowest px-4 py-6 ring-1 ring-outline-variant">
        <h2 className="text-lg font-semibold">今日の夕食</h2>
        <p className="mt-3 text-sm text-on-surface-variant">
          今日の献立がまだありません
        </p>
        <Link
          href="/meals"
          className="mt-4 inline-block text-sm font-medium text-primary"
        >
          献立画面で作成する
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-surface-container-lowest px-4 py-5 ring-1 ring-outline-variant">
      <h2 className="text-lg font-semibold">今日の夕食</h2>

      <ul className="mt-4 space-y-3">
        {dishes.map((dish) => (
          <li key={dish.mealItemId} className="flex items-baseline gap-3">
            <span className="w-12 shrink-0 text-sm text-on-surface-variant">
              {dish.course}
            </span>
            <span className="min-w-0 flex-1 text-base font-semibold leading-snug">
              {dish.title}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
        {servings != null ? (
          <DayServingsEditor
            servings={servings}
            isCustom={servingsIsCustom}
            defaultMealServings={defaultMealServings}
            onChange={onChangeServings}
            onReset={onResetServings}
          />
        ) : (
          <span>人数未設定</span>
        )}
        <span>
          {cookingTimeMinutes != null
            ? `約${cookingTimeMinutes}分`
            : "時間未設定"}
        </span>
      </div>

      {decisionReasons ? (
        <MealReasonPanel
          messages={decisionReasons.messages}
          details={decisionReasons.details}
        />
      ) : null}

      {primaryCook ? (
        <Link
          href={primaryCook.cookHref}
          className="mt-5 flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-4 text-lg font-bold text-on-primary"
        >
          調理する
        </Link>
      ) : (
        <p className="mt-5 rounded-xl bg-surface-container px-3 py-3 text-center text-sm text-on-surface-variant">
          レシピ付きの料理がないため、調理モードを開けません
        </p>
      )}
    </section>
  );
}
