import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import {
  DEFAULT_INGREDIENT_TYPE,
  isIngredientType,
} from "@/types/ingredient-meta";
import type {
  ShoppingItemSource,
  ShoppingList,
  ShoppingListItem,
  ShoppingListKind,
  ShoppingQuantity,
} from "@/types/shopping-list";

type ShoppingListRow = Tables<"shopping_lists">;

function isListKind(value: unknown): value is ShoppingListKind {
  return value === "buy" || value === "pantryCheck";
}

function migrateQuantity(value: unknown): ShoppingQuantity | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const item = value as Record<string, unknown>;
  return {
    quantity:
      item.quantity === null || typeof item.quantity === "number"
        ? item.quantity
        : null,
    unit: typeof item.unit === "string" ? item.unit : "",
    note: typeof item.note === "string" ? item.note : "",
  };
}

function migrateSource(value: unknown): ShoppingItemSource | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const item = value as Record<string, unknown>;
  return {
    recipeId: typeof item.recipeId === "string" ? item.recipeId : null,
    recipeName: typeof item.recipeName === "string" ? item.recipeName : "",
    mealItemId: typeof item.mealItemId === "string" ? item.mealItemId : null,
    date: typeof item.date === "string" ? item.date : "",
    quantity:
      item.quantity === null || typeof item.quantity === "number"
        ? item.quantity
        : null,
    unit: typeof item.unit === "string" ? item.unit : "",
    note: typeof item.note === "string" ? item.note : "",
  };
}

function migrateItem(value: unknown): ShoppingListItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.ingredientName !== "string") {
    return null;
  }

  const quantities = Array.isArray(item.quantities)
    ? item.quantities
        .map(migrateQuantity)
        .filter((q): q is ShoppingQuantity => q !== null)
    : [{ quantity: null, unit: "", note: "" }];

  const sources = Array.isArray(item.sources)
    ? item.sources
        .map(migrateSource)
        .filter((s): s is ShoppingItemSource => s !== null)
    : [];

  return {
    id: item.id,
    ingredientName: item.ingredientName,
    checked: item.checked === true,
    manuallyAdded: item.manuallyAdded === true,
    ingredientType: isIngredientType(item.ingredientType)
      ? item.ingredientType
      : DEFAULT_INGREDIENT_TYPE,
    listKind: isListKind(item.listKind) ? item.listKind : "buy",
    quantities:
      quantities.length > 0
        ? quantities
        : [{ quantity: null, unit: "", note: "" }],
    sources,
  };
}

export function shoppingListFromRow(row: ShoppingListRow): ShoppingList {
  const items = (Array.isArray(row.items) ? row.items : [])
    .map(migrateItem)
    .filter((item): item is ShoppingListItem => item !== null);

  return {
    id: row.id,
    weekStart:
      typeof row.week_start === "string"
        ? row.week_start.slice(0, 10)
        : String(row.week_start),
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function shoppingListToUpsert(
  list: ShoppingList,
  householdId: string,
  userId: string | null,
): TablesInsert<"shopping_lists"> {
  return {
    id: list.id,
    household_id: householdId,
    week_start: list.weekStart,
    items: list.items,
    created_by: userId,
    updated_by: userId,
    created_at: list.createdAt,
    updated_at: list.updatedAt,
  };
}
