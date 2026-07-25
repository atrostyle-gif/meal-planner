import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import type { InventoryAmount, InventoryItem } from "@/types/inventory";

type InventoryRow = Tables<"inventory_items">;

function migrateAmount(value: unknown): InventoryAmount | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const item = value as Record<string, unknown>;
  if (item.kind === "preset" && typeof item.preset === "string") {
    if (
      item.preset === "little" ||
      item.preset === "half" ||
      item.preset === "lot"
    ) {
      return { kind: "preset", preset: item.preset };
    }
  }
  if (item.kind === "text" && typeof item.value === "string") {
    return { kind: "text", value: item.value };
  }
  if (item.kind === "quantity" && typeof item.value === "number") {
    return {
      kind: "quantity",
      value: item.value,
      unitCode: typeof item.unitCode === "string" ? item.unitCode : undefined,
    };
  }
  return null;
}

export function inventoryFromRow(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    amount: migrateAmount(row.amount),
    unit: row.unit ?? "",
    priority: row.priority === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function inventoryToInsert(
  item: InventoryItem,
  householdId: string,
  userId: string | null,
): TablesInsert<"inventory_items"> {
  return {
    id: item.id,
    household_id: householdId,
    name: item.name,
    amount: item.amount,
    unit: item.unit,
    priority: item.priority,
    created_by: userId,
    updated_by: userId,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}
