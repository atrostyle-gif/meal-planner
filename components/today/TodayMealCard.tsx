"use client";

import Link from "next/link";
import { CompactMenu } from "@/components/meals/CompactMenu";
import type { TodayMealCard as TodayMealCardModel } from "@/lib/today/dashboard";

type TodayMealCardProps = {
  meal: TodayMealCardModel;
  onOpenMenu?: (href: string) => void;
};

export function TodayMealCard({ meal, onOpenMenu }: TodayMealCardProps) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface-container-lowest px-3 py-3 ring-1 ring-outline-variant">
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container"
        aria-hidden
      >
        {meal.photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL の完成写真
          <img
            src={meal.photoDataUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs text-on-surface-variant">写真</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-on-surface-variant">{meal.courseLabel}</p>
        <p className="truncate font-semibold">{meal.title}</p>
        <p className="text-xs text-on-surface-variant">
          {meal.cookingTimeMinutes != null
            ? `${meal.cookingTimeMinutes}分`
            : "時間未設定"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {meal.cookHref ? (
          <Link
            href={meal.cookHref}
            className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary"
          >
            開始
          </Link>
        ) : null}
        {meal.recipeHref || meal.cookHref ? (
          <CompactMenu
            label="メニュー"
            trigger={<span className="px-1.5 text-base leading-none">⋯</span>}
            items={[
              ...(meal.recipeHref
                ? [
                    {
                      id: "recipe",
                      label: "レシピを見る",
                      onClick: () => onOpenMenu?.(meal.recipeHref!),
                    },
                  ]
                : []),
              ...(meal.cookHref
                ? [
                    {
                      id: "cook",
                      label: "開始",
                      onClick: () => onOpenMenu?.(meal.cookHref!),
                    },
                  ]
                : []),
            ]}
          />
        ) : null}
      </div>
    </li>
  );
}
