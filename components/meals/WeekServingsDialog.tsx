"use client";

import { useMemo, useState } from "react";
import { WEEKDAY_LABELS, parseDate } from "@/lib/date";
import {
  loadDefaultMealServings,
  resolveDayServings,
} from "@/lib/servings/resolve";
import type { DayMeal } from "@/types/meal-plan";

type WeekServingsDialogProps = {
  days: DayMeal[];
  defaultMealServings?: number;
  onSave: (entries: Record<string, number | null>) => void;
  onClose: () => void;
};

/** 補助機能: 今週の人数をまとめて見る／変える */
export function WeekServingsDialog({
  days,
  defaultMealServings = loadDefaultMealServings(),
  onSave,
  onClose,
}: WeekServingsDialogProps) {
  const initial = useMemo(() => {
    const map: Record<string, number> = {};
    for (const day of days) {
      map[day.date] = resolveDayServings(day, defaultMealServings).servings;
    }
    return map;
  }, [days, defaultMealServings]);

  const [draft, setDraft] = useState<Record<string, number>>(initial);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal
      aria-label="今週の人数設定"
    >
      <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-4 shadow-lg ring-1 ring-outline-variant">
        <h2 className="text-base font-semibold">今週の人数設定</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          通常は {defaultMealServings}人です。来客や不在の日だけ変えてください。
        </p>
        <ul className="mt-4 space-y-2">
          {days.map((day) => {
            const weekdayIndex = (parseDate(day.date).getDay() + 6) % 7;
            const value = draft[day.date] ?? defaultMealServings;
            return (
              <li
                key={day.date}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-sm">{WEEKDAY_LABELS[weekdayIndex]}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 w-8 rounded-lg bg-surface-container"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        [day.date]: Math.max(1, value - 1),
                      }))
                    }
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-semibold">
                    {value}人
                  </span>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-lg bg-surface-container"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        [day.date]: Math.min(20, value + 1),
                      }))
                    }
                  >
                    ＋
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl px-3 py-2.5 text-sm ring-1 ring-outline-variant"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary"
            onClick={() => {
              const entries: Record<string, number | null> = {};
              for (const day of days) {
                const value = draft[day.date] ?? defaultMealServings;
                entries[day.date] =
                  value === defaultMealServings ? null : value;
              }
              onSave(entries);
              onClose();
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
