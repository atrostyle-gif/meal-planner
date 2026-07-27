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
import { MealSlotCard } from "@/components/meals/MealSlotCard";
import { WEEKDAY_LABELS, formatMonthDay, parseDate } from "@/lib/date";
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
  onToggleDayLock: (date: string) => void;
  onToggleSlotLock: (date: string, itemId: string) => void;
  onRegenerateDay: (date: string) => void;
  onRegenerateSlot: (date: string, course: (typeof WEEKLY_AUTO_COURSES)[number], slotId?: string) => void;
  onRemoveItem: (date: string, itemId: string) => void;
  onMoveOrSwap: (
    fromDate: string,
    toDate: string,
    itemId: string,
    targetItemId?: string | null,
  ) => void;
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
  onToggleDayLock,
  onToggleSlotLock,
  onRegenerateDay,
  onRegenerateSlot,
  onRemoveItem,
}: {
  day: DayMeal;
  recipes: Recipe[];
  onToggleDayLock: (date: string) => void;
  onToggleSlotLock: (date: string, itemId: string) => void;
  onRegenerateDay: (date: string) => void;
  onRegenerateSlot: (
    date: string,
    course: (typeof WEEKLY_AUTO_COURSES)[number],
    slotId?: string,
  ) => void;
  onRemoveItem: (date: string, itemId: string) => void;
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
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {WEEKDAY_LABELS[weekdayIndex]}
          <span className="ml-2 font-normal text-on-surface-variant">
            {formatMonthDay(day.date)}
          </span>
          {day.locked ? (
            <span className="ml-2 text-xs font-normal text-on-surface-variant">
              🔒
            </span>
          ) : null}
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
                  onRegenerate={
                    day.locked
                      ? undefined
                      : () => onRegenerateSlot(day.date, course)
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
  onToggleDayLock,
  onToggleSlotLock,
  onRegenerateDay,
  onRegenerateSlot,
  onRemoveItem,
  onMoveOrSwap,
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
              onToggleDayLock={onToggleDayLock}
              onToggleSlotLock={onToggleSlotLock}
              onRegenerateDay={onRegenerateDay}
              onRegenerateSlot={onRegenerateSlot}
              onRemoveItem={onRemoveItem}
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
