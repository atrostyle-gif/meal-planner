import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import { isRecipeCourse } from "@/types/course";
import type {
  DayMeal,
  MealDishItem,
  MealPlan,
  MealSource,
} from "@/types/meal-plan";

type MealPlanRow = Tables<"meal_plans">;

function isMealSource(value: unknown): value is MealSource {
  return value === "manual" || value === "fixed" || value === "auto";
}

function migrateDishItem(value: unknown, index: number): MealDishItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const item = value as Record<string, unknown>;
  const course = isRecipeCourse(item.course) ? item.course : "その他";
  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    recipeId: typeof item.recipeId === "string" ? item.recipeId : null,
    course,
    order: typeof item.order === "number" ? item.order : index + 1,
    customName: typeof item.customName === "string" ? item.customName : null,
    source: isMealSource(item.source) ? item.source : undefined,
    notes: typeof item.notes === "string" ? item.notes : undefined,
    servingsOverride:
      typeof item.servingsOverride === "number" ? item.servingsOverride : null,
  };
}

function migrateDayMeal(value: unknown): DayMeal | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const day = value as Record<string, unknown>;
  if (typeof day.date !== "string") {
    return null;
  }
  const rawItems = Array.isArray(day.items) ? day.items : [];
  const items = rawItems
    .map((item, index) => migrateDishItem(item, index))
    .filter((item): item is MealDishItem => item !== null);

  return {
    date: day.date,
    locked: day.locked === true,
    items,
  };
}

export function mealPlanFromRow(row: MealPlanRow): MealPlan {
  const days = (Array.isArray(row.days) ? row.days : [])
    .map((day) => migrateDayMeal(day))
    .filter((day): day is DayMeal => day !== null);

  return {
    id: row.id,
    weekStart:
      typeof row.week_start === "string"
        ? row.week_start.slice(0, 10)
        : String(row.week_start),
    days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mealPlanToUpsert(
  plan: MealPlan,
  householdId: string,
  userId: string | null,
): TablesInsert<"meal_plans"> {
  return {
    id: plan.id,
    household_id: householdId,
    week_start: plan.weekStart,
    days: plan.days,
    created_by: userId,
    updated_by: userId,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
  };
}
