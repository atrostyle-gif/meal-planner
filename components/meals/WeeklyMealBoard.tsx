"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { useMemo, useState, type ReactNode } from "react";
import { CompactMenu } from "@/components/meals/CompactMenu";
import { DayServingsEditor } from "@/components/meals/DayServingsEditor";
import { MealSlotCard } from "@/components/meals/MealSlotCard";
import { WEEKDAY_LABELS, formatMonthDay, parseDate } from "@/lib/date";
import { resolveDayServings } from "@/lib/servings/resolve";
import { WEEKLY_AUTO_COURSES } from "@/types/weekly-meal-plan";
import { formatCourseLabel } from "@/types/course";
import type { DayMeal, MealDishItem } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";

function DayReasonLine({ reasons }: { reasons: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (reasons.length === 0) return null;
  const first = reasons[0] ?? "";
  const hasMore = reasons.length > 1 || first.length > 40;
  return (
    <div className="mt-2">
      <p className="truncate text-xs text-on-surface-variant">
        {first}
      </p>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 text-[11px] font-medium text-primary"
        >
          {expanded ? "閉じる" : "▼ 理由"}
        </button>
      ) : null}
      {expanded ? (
        <ul className="mt-1 space-y-0.5 text-xs text-on-surface-variant">
          {reasons.map((reason) => (
            <li key={reason}>・{reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type WeeklyMealBoardProps = {
  days: DayMeal[];
  recipes: Recipe[];
  defaultMealServings: number;
  onToggleDayLock: (date: string) => void;
  onToggleSlotLock: (date: string, itemId: string) => void;
  onRegenerateDay: (date: string) => void;
  onRegenerateSlot: (date: string, course: (typeof WEEKLY_AUTO_COURSES)[number], slotId?: string) => void;
  /** 空き枠の「料理を追加」→ おすすめ候補 */
  onAddDish: (date: string, course: (typeof WEEKLY_AUTO_COURSES)[number], slotId?: string) => void;
  onRemoveItem: (date: string, itemId: string) => void;
  onMoveOrSwap: (
    fromDate: string,
    toDate: string,
    itemId: string,
    targetItemId?: string | null,
  ) => void;
  onChangeDayServings: (date: string, servings: number) => void;
  onResetDayServings: (date: string) => void;
};

type DragData = {
  date: string;
  item: MealDishItem;
};

function DraggableSlot({
  date,
  item,
  recipe,
  children,
}: {
  date: string;
  item: MealDishItem;
  recipe: Recipe | null;
  children: (args: {
    setNodeRef: (node: HTMLElement | null) => void;
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown> | undefined;
    isDragging: boolean;
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { date, item, recipe } satisfies DragData & { recipe: Recipe | null },
    disabled: Boolean(item.slotLocked),
  });

  return (
    <>
      {children({
        setNodeRef,
        attributes: attributes as unknown as Record<string, unknown>,
        listeners: listeners as unknown as Record<string, unknown> | undefined,
        isDragging,
      })}
    </>
  );
}

function DayColumn({
  day,
  recipes,
  defaultMealServings,
  onToggleDayLock,
  onToggleSlotLock,
  onRegenerateDay,
  onRegenerateSlot,
  onAddDish,
  onRemoveItem,
  onChangeDayServings,
  onResetDayServings,
}: {
  day: DayMeal;
  recipes: Recipe[];
  defaultMealServings: number;
  onToggleDayLock: (date: string) => void;
  onToggleSlotLock: (date: string, itemId: string) => void;
  onRegenerateDay: (date: string) => void;
  onRegenerateSlot: (
    date: string,
    course: (typeof WEEKLY_AUTO_COURSES)[number],
    slotId?: string,
  ) => void;
  onAddDish: (
    date: string,
    course: (typeof WEEKLY_AUTO_COURSES)[number],
    slotId?: string,
  ) => void;
  onRemoveItem: (date: string, itemId: string) => void;
  onChangeDayServings: (date: string, servings: number) => void;
  onResetDayServings: (date: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${day.date}`,
    data: { date: day.date },
    disabled: day.locked,
  });
  const weekdayIndex = (parseDate(day.date).getDay() + 6) % 7;
  const recipeMap = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe])),
    [recipes],
  );
  const resolved = resolveDayServings(day, defaultMealServings);

  return (
    <section
      ref={setNodeRef}
      className={`rounded-2xl p-3 shadow-sm ring-1 transition ${
        day.locked
          ? "bg-fixed-container ring-2 ring-fixed"
          : isOver
            ? "bg-secondary-container ring-2 ring-primary"
            : "bg-surface-container-lowest ring-outline-variant"
      }`}
    >
      <div className="mb-2 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <p className="text-lg font-bold tracking-tight text-on-surface">
              {WEEKDAY_LABELS[weekdayIndex]}
            </p>
            {day.locked ? (
              <span className="text-xs text-on-surface-variant">🔒</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-right text-sm text-on-surface-variant">
              {formatMonthDay(day.date)}
            </p>
            <CompactMenu
              label={`${WEEKDAY_LABELS[weekdayIndex]}の操作`}
              items={[
                {
                  id: "day-lock",
                  label: day.locked ? "日ロック解除" : "日をロック",
                  onClick: () => onToggleDayLock(day.date),
                },
                {
                  id: "day-regen",
                  label: "この日を再生成",
                  onClick: () => onRegenerateDay(day.date),
                  disabled: day.locked,
                },
              ]}
            />
          </div>
        </div>
        <DayServingsEditor
          servings={resolved.servings}
          isCustom={resolved.isCustom}
          defaultMealServings={defaultMealServings}
          onChange={(servings) => onChangeDayServings(day.date, servings)}
          onReset={() => onResetDayServings(day.date)}
        />
      </div>

      {day.recommendation?.reasons?.length ? (
        <DayReasonLine reasons={day.recommendation.reasons} />
      ) : null}

      <ul className="mt-2 space-y-2">
        {WEEKLY_AUTO_COURSES.map((course) => {
          const item =
            day.items.find((entry) => entry.course === course) ?? null;
          const recipe =
            item?.recipeId != null
              ? recipeMap.get(item.recipeId) ?? null
              : null;

          if (!item) {
            return (
              <li key={course}>
                <MealSlotCard
                  item={null}
                  recipe={null}
                  courseLabel={formatCourseLabel(course)}
                  empty
                  onAddDish={
                    day.locked
                      ? undefined
                      : () => onAddDish(day.date, course)
                  }
                />
              </li>
            );
          }

          return (
            <li key={item.id}>
              <DraggableSlot date={day.date} item={item} recipe={recipe}>
                {({ setNodeRef, attributes, listeners, isDragging }) => (
                  <div ref={setNodeRef}>
                    <MealSlotCard
                      item={item}
                      recipe={recipe}
                      courseLabel={formatCourseLabel(course)}
                      isDragging={isDragging}
                      dragHandleProps={{ ...attributes, ...listeners }}
                      onToggleLock={() => onToggleSlotLock(day.date, item.id)}
                      onAddDish={
                        day.locked || item.slotLocked
                          ? undefined
                          : () => onAddDish(day.date, course, item.id)
                      }
                      onRegenerate={
                        day.locked || item.slotLocked
                          ? undefined
                          : () => onRegenerateSlot(day.date, course, item.id)
                      }
                      onRemove={
                        day.locked || item.slotLocked
                          ? undefined
                          : () => onRemoveItem(day.date, item.id)
                      }
                    />
                  </div>
                )}
              </DraggableSlot>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function WeeklyMealBoard({
  days,
  recipes,
  defaultMealServings,
  onToggleDayLock,
  onToggleSlotLock,
  onRegenerateDay,
  onRegenerateSlot,
  onAddDish,
  onRemoveItem,
  onMoveOrSwap,
  onChangeDayServings,
  onResetDayServings,
}: WeeklyMealBoardProps) {
  const [active, setActive] = useState<{
    item: MealDishItem;
    recipe: Recipe | null;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
  );

  function handleDragStart(event: DragStartEvent): void {
    const data = event.active.data.current as
      | (DragData & { recipe: Recipe | null })
      | undefined;
    if (!data) return;
    setActive({ item: data.item, recipe: data.recipe });
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActive(null);
    const { active: activeDrag, over } = event;
    if (!over) return;

    const from = activeDrag.data.current as DragData | undefined;
    if (!from) return;

    const overId = String(over.id);
    let toDate: string | null = null;
    let targetItemId: string | null = null;

    if (overId.startsWith("day:")) {
      toDate = overId.slice(4);
    } else {
      // 他カードの上にドロップ → 交換
      for (const day of days) {
        const hit = day.items.find((item) => item.id === overId);
        if (hit) {
          toDate = day.date;
          targetItemId = hit.id;
          break;
        }
      }
    }

    if (!toDate || toDate === from.date) {
      if (toDate === from.date && targetItemId && targetItemId !== from.item.id) {
        onMoveOrSwap(from.date, toDate, from.item.id, targetItemId);
      }
      return;
    }

    onMoveOrSwap(from.date, toDate, from.item.id, targetItemId);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ul className="space-y-3">
        {days.map((day) => (
          <li key={day.date}>
            <DayColumn
              day={day}
              recipes={recipes}
              defaultMealServings={defaultMealServings}
              onToggleDayLock={onToggleDayLock}
              onToggleSlotLock={onToggleSlotLock}
              onRegenerateDay={onRegenerateDay}
              onRegenerateSlot={onRegenerateSlot}
              onAddDish={onAddDish}
              onRemoveItem={onRemoveItem}
              onChangeDayServings={onChangeDayServings}
              onResetDayServings={onResetDayServings}
            />
          </li>
        ))}
      </ul>

      <DragOverlay>
        {active ? (
          <div className="w-[min(100vw-2rem,24rem)]">
            <MealSlotCard
              item={active.item}
              recipe={active.recipe}
              courseLabel={formatCourseLabel(active.item.course)}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
