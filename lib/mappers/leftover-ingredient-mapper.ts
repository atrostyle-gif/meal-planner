import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import {
  isLeftoverSource,
  isLeftoverStatus,
  type LeftoverIngredient,
} from "@/types/leftover-ingredient";
import { normalizeIngredientName } from "@/lib/food-master/normalize";

type LeftoverRow = Tables<"leftover_ingredients">;

/** Supabase check 制約に合わせる（manual_meal_plan → manual） */
function toDbSource(source: LeftoverIngredient["source"]): string {
  if (source === "manual_meal_plan") return "manual";
  return source;
}

function packNotes(item: LeftoverIngredient): string | null {
  const meta: string[] = [];
  if (item.weekStart) meta.push(`week:${item.weekStart}`);
  if (item.quantityText) meta.push(`qty:${item.quantityText}`);
  if (item.foodCode) meta.push(`code:${item.foodCode}`);
  if (item.rawName && item.rawName !== item.name) {
    meta.push(`raw:${item.rawName}`);
  }
  const body = item.notes?.trim() ?? "";
  if (meta.length === 0) return body || null;
  const packed = `[mp]${meta.join("|")}`;
  return body ? `${packed} ${body}` : packed;
}

function unpackNotes(notes: string | null): {
  notes: string | null;
  weekStart: string | null;
  quantityText: string | null;
  foodCode: string | null;
  rawName: string | null;
} {
  if (!notes) {
    return {
      notes: null,
      weekStart: null,
      quantityText: null,
      foodCode: null,
      rawName: null,
    };
  }
  if (!notes.startsWith("[mp]")) {
    return {
      notes,
      weekStart: null,
      quantityText: null,
      foodCode: null,
      rawName: null,
    };
  }
  const rest = notes.slice(4);
  const spaceIndex = rest.search(/\s/);
  const metaPart = spaceIndex === -1 ? rest : rest.slice(0, spaceIndex);
  const body = spaceIndex === -1 ? "" : rest.slice(spaceIndex + 1).trim();
  let weekStart: string | null = null;
  let quantityText: string | null = null;
  let foodCode: string | null = null;
  let rawName: string | null = null;
  for (const part of metaPart.split("|")) {
    if (part.startsWith("week:")) weekStart = part.slice(5);
    else if (part.startsWith("qty:")) quantityText = part.slice(4);
    else if (part.startsWith("code:")) foodCode = part.slice(5);
    else if (part.startsWith("raw:")) rawName = part.slice(4);
  }
  return {
    notes: body || null,
    weekStart,
    quantityText,
    foodCode,
    rawName,
  };
}

export function leftoverIngredientFromRow(row: LeftoverRow): LeftoverIngredient {
  const unpacked = unpackNotes(row.notes);
  const name = row.name;
  const rawName = unpacked.rawName || name;
  return {
    id: row.id,
    householdId: row.household_id,
    name,
    rawName,
    normalizedName: normalizeIngredientName(name),
    foodCode: unpacked.foodCode ?? row.food_master_id,
    foodMasterId: row.food_master_id,
    quantityText: unpacked.quantityText,
    quantity: row.quantity,
    unit: row.unit,
    priority: "soon",
    notes: unpacked.notes,
    source:
      row.source === "manual"
        ? unpacked.weekStart
          ? "manual_meal_plan"
          : "manual"
        : isLeftoverSource(row.source)
          ? row.source
          : "manual",
    status: isLeftoverStatus(row.status) ? row.status : "active",
    weekStart: unpacked.weekStart,
    plannedForDates: Array.isArray(row.planned_for_dates)
      ? row.planned_for_dates.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    migratedFromInventoryId: row.migrated_from_inventory_id,
    includeInProposal: row.include_in_proposal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function leftoverIngredientToUpsert(
  item: LeftoverIngredient,
  householdId: string,
): TablesInsert<"leftover_ingredients"> {
  return {
    id: item.id,
    household_id: householdId,
    name: item.name,
    food_master_id: item.foodMasterId ?? item.foodCode,
    quantity: item.quantity,
    unit: item.unit,
    priority: "soon",
    notes: packNotes(item),
    source: toDbSource(item.source),
    status: item.status,
    planned_for_dates: item.plannedForDates,
    migrated_from_inventory_id: item.migratedFromInventoryId,
    include_in_proposal: item.includeInProposal,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}
