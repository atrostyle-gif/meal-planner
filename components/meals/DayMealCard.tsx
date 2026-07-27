"use client";

import { useState } from "react";
import { MealDishRow } from "@/components/meals/MealDishRow";
import { RecipePickerModal } from "@/components/meals/RecipePickerModal";
import { WEEKDAY_LABELS, formatMonthDay, parseDate } from "@/lib/date";
import { formatStars } from "@/lib/recipe-nutrition";
import { getCourseIcon } from "@/types/recipe";
import type {
  DayMeal,
  DayMealRecommendation,
  MealDishItem,
} from "@/types/meal-plan";
import type { Recipe, RecipeCourse } from "@/types/recipe";
import type { CookingMemberProfile, DailyCookingOverride } from "@/types/weekly-lifestyle";
import { dateToDayOfWeek } from "@/types/weekly-lifestyle";
import { getScheduleForDay } from "@/lib/weekly-cooking-schedules";
import { getOverrideForDate, upsertDailyCookingOverride } from "@/lib/daily-cooking-overrides";

type DayMealCardProps = {
  day: DayMeal;
  recipes: Recipe[];
  onToggleLocked: () => void;
  onAddRecipe: (recipe: Recipe) => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
  onChangeCourse: (itemId: string, course: RecipeCourse) => void;
  onRemoveItem: (itemId: string) => void;
  householdId: string;
  cookingProfiles: CookingMemberProfile[];
  memberDisplayNames: Record<string, string>;
};

export function DayMealCard({
  day,
  recipes,
  onToggleLocked,
  onAddRecipe,
  onMoveItem,
  onChangeCourse,
  onRemoveItem,
  householdId,
  cookingProfiles,
  memberDisplayNames,
}: DayMealCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const weekdayIndex = (parseDate(day.date).getDay() + 6) % 7;
  const orderedItems = [...day.items].sort((left, right) => left.order - right.order);
  const recommendation = day.recommendation;
  const [lifestyleRefresh, setLifestyleRefresh] = useState(0);
  const schedule = getScheduleForDay(householdId, dateToDayOfWeek(day.date));
  const override = getOverrideForDate(householdId, day.date);
  const cookId = override?.cookMemberId ?? schedule?.defaultCookMemberId ?? null;
  const cookName = cookId
    ? memberDisplayNames[cookId] ?? cookingProfiles.find((profile) => profile.familyMemberProfileId === cookId)?.familyMemberProfileId ?? "未設定"
    : "未設定";
  const limit = override?.cookingTimeLimitMinutes ?? schedule?.cookingTimeLimitMinutes ?? null;
  void lifestyleRefresh;
  function saveOverride(patch: Partial<DailyCookingOverride>): void {
    const current = getOverrideForDate(householdId, day.date);
    upsertDailyCookingOverride({
      id: current?.id ?? crypto.randomUUID(), householdId, date: day.date,
      cookMemberId: current?.cookMemberId ?? null, isEatingOut: current?.isEatingOut ?? false,
      skipMealPlanning: current?.skipMealPlanning ?? false, cookingTimeLimitMinutes: current?.cookingTimeLimitMinutes ?? null,
      effortLevel: current?.effortLevel ?? null, shoppingAvailable: current?.shoppingAvailable ?? null,
      allowNewRecipes: current?.allowNewRecipes ?? null, participantMemberIds: current?.participantMemberIds ?? [],
      notes: current?.notes ?? null, ...patch,
    });
    setLifestyleRefresh((value) => value + 1);
  }

  return (
    <article
      className={`rounded-2xl p-4 shadow-sm ring-1 transition ${
        day.locked
          ? "bg-fixed-container ring-2 ring-fixed text-on-fixed-container"
          : "bg-surface-container-lowest ring-outline-variant"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {WEEKDAY_LABELS[weekdayIndex]}
            <span className="ml-2 font-normal text-on-surface-variant">
              {formatMonthDay(day.date)}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-on-surface-variant">
            <span>担当: {cookName}</span>
            {limit != null ? <span>{limit}分以内</span> : null}
            {schedule ? <span>手間: {schedule.effortLevel}</span> : null}
            {schedule?.shoppingAvailable ? <span>買い物可</span> : null}
            {override?.isEatingOut ? <span className="font-medium text-primary">外食</span> : null}
            {override?.skipMealPlanning ? <span className="font-medium text-primary">献立をスキップ</span> : null}
          </div>
          {orderedItems.length === 0 ? (
            <p className="mt-2 text-base text-on-surface-variant">未設定</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {orderedItems.map((item) => (
                <li key={item.id} className="text-sm text-on-surface">
                  <DishSummary item={item} recipes={recipes} />
                </li>
              ))}
            </ul>
          )}

          {recommendation && orderedItems.length > 0 ? (
            <DayRecommendationCompact recommendation={recommendation} />
          ) : null}
        </div>

        <button
          type="button"
          onClick={onToggleLocked}
          className={`rounded-xl px-3 py-2 text-lg leading-none ${
            day.locked
              ? "bg-fixed text-on-fixed"
              : "bg-surface-container text-on-surface-variant"
          }`}
          aria-label={day.locked ? "固定を解除" : "固定する"}
          aria-pressed={day.locked}
          title={day.locked ? "固定中（自動作成で変更しません）" : "固定する"}
        >
          🔒
        </button>
      </div>

      <div className="mt-4 space-y-2 border-t border-outline-variant pt-4">
        <details className="rounded-xl bg-surface-container p-3 text-sm">
          <summary className="cursor-pointer font-medium">今日だけ設定</summary>
          <div className="mt-2 space-y-2">
            <label className="block text-xs">作る人<select value={cookId ?? ""} onChange={(e) => saveOverride({ cookMemberId: e.target.value || null })} className="mt-1 w-full rounded-lg bg-surface-container-lowest p-2 text-sm"><option value="">未設定</option>{cookingProfiles.map((profile) => <option key={profile.id} value={profile.familyMemberProfileId}>{memberDisplayNames[profile.familyMemberProfileId] ?? "家族"}</option>)}</select></label>
            <label className="block text-xs">時間（分）<input type="number" value={override?.cookingTimeLimitMinutes ?? ""} onChange={(e) => saveOverride({ cookingTimeLimitMinutes: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1 w-full rounded-lg bg-surface-container-lowest p-2 text-sm" /></label>
          </div>
        </details>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => saveOverride({ isEatingOut: !override?.isEatingOut, skipMealPlanning: false })} className="rounded-xl p-2 text-sm ring-1 ring-outline-variant">{override?.isEatingOut ? "外食を解除" : "外食にする"}</button>
          <button type="button" onClick={() => saveOverride({ skipMealPlanning: !override?.skipMealPlanning, isEatingOut: false })} className="rounded-xl p-2 text-sm ring-1 ring-outline-variant">{override?.skipMealPlanning ? "スキップを解除" : "献立をスキップ"}</button>
        </div>
        {orderedItems.map((item, index) => (
          <MealDishRow
            key={item.id}
            item={item}
            recipes={recipes}
            date={day.date}
            isFirst={index === 0}
            isLast={index === orderedItems.length - 1}
            onMove={(direction) => onMoveItem(item.id, direction)}
            onChangeCourse={(course) => onChangeCourse(item.id, course)}
            onRemove={() => onRemoveItem(item.id)}
          />
        ))}

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full rounded-xl border border-dashed border-outline px-4 py-3 text-sm font-medium text-primary"
        >
          ＋ 料理を追加
        </button>
      </div>

      {pickerOpen ? (
        <RecipePickerModal
          recipes={recipes}
          onClose={() => setPickerOpen(false)}
          onSelect={(recipe) => {
            onAddRecipe(recipe);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </article>
  );
}

function DishSummary({
  item,
  recipes,
}: {
  item: MealDishItem;
  recipes: Recipe[];
}) {
  const recipe = item.recipeId
    ? recipes.find((entry) => entry.id === item.recipeId)
    : null;
  const name =
    item.customName?.trim() ||
    recipe?.name ||
    "（削除済みレシピ）";

  return (
    <span>
      <span aria-hidden>{getCourseIcon(item.course)} </span>
      {name}
    </span>
  );
}

/** 理由は1行。全文は展開 */
function DayRecommendationCompact({
  recommendation,
}: {
  recommendation: DayMealRecommendation;
}) {
  const [expanded, setExpanded] = useState(false);
  const first = recommendation.reasons[0] ?? "";
  return (
    <div className="mt-3 rounded-xl bg-surface-container px-3 py-2">
      <p className="text-sm font-medium">
        <span
          className="text-primary"
          aria-label={`おすすめ度${recommendation.stars}`}
        >
          {formatStars(recommendation.stars)}
        </span>
      </p>
      {first ? (
        <p className="mt-1 truncate text-xs text-on-surface-variant">{first}</p>
      ) : null}
      {recommendation.reasons.length > 1 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-medium text-primary"
        >
          {expanded ? "閉じる" : "▼ 理由"}
        </button>
      ) : null}
      {expanded ? (
        <ul className="mt-1 space-y-0.5 text-xs text-on-surface-variant">
          {recommendation.reasons.map((reason) => (
            <li key={reason}>・{reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
