import { generateShoppingListFromMealPlan } from "@/lib/shopping/generate-shopping-list";
import { getActiveLeftoversForProposal } from "@/lib/leftover-ingredients";
import {
  loadRecurringPurchaseIngredients,
} from "@/lib/recurring-purchase-ingredients";
import { getRecurringForShoppingDeduction } from "@/lib/recurring-purchase-match";
import { normalizeIngredientName } from "@/lib/shopping/normalize-ingredient-name";
import { hasStorageKey, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  DEFAULT_INGREDIENT_TYPE,
  isIngredientType,
  type IngredientType,
} from "@/types/ingredient-meta";
import type { MealPlan } from "@/types/meal-plan";
import type { Recipe } from "@/types/recipe";
import type {
  ShoppingItemSource,
  ShoppingList,
  ShoppingListItem,
  ShoppingListItemInput,
  ShoppingListKind,
  ShoppingQuantity,
} from "@/types/shopping-list";

type Listener = () => void;

let cachedRaw: string | null | undefined = undefined;
let cachedLists: ShoppingList[] = [];
const listeners = new Set<Listener>();

function isShoppingQuantity(value: unknown): value is ShoppingQuantity {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    (item.quantity === null || typeof item.quantity === "number") &&
    typeof item.unit === "string" &&
    typeof item.note === "string"
  );
}

function isShoppingItemSource(value: unknown): value is ShoppingItemSource {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    (item.recipeId === null || typeof item.recipeId === "string") &&
    typeof item.recipeName === "string" &&
    (item.mealItemId === null || typeof item.mealItemId === "string") &&
    typeof item.date === "string" &&
    (item.quantity === null || typeof item.quantity === "number") &&
    typeof item.unit === "string" &&
    typeof item.note === "string"
  );
}

function isListKind(value: unknown): value is ShoppingListKind {
  return value === "buy" || value === "pantryCheck";
}

function migrateShoppingListItem(value: unknown): ShoppingListItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.ingredientName !== "string") {
    return null;
  }

  const checked = typeof item.checked === "boolean" ? item.checked : false;
  const manuallyAdded =
    typeof item.manuallyAdded === "boolean" ? item.manuallyAdded : false;
  const ingredientType: IngredientType = isIngredientType(item.ingredientType)
    ? item.ingredientType
    : DEFAULT_INGREDIENT_TYPE;
  const listKind: ShoppingListKind = isListKind(item.listKind)
    ? item.listKind
    : "buy";

  // 新形式
  if (Array.isArray(item.quantities) && Array.isArray(item.sources)) {
    const quantities = item.quantities.filter(isShoppingQuantity);
    const sources = item.sources.filter(isShoppingItemSource);
    return {
      id: item.id,
      ingredientName: item.ingredientName,
      checked,
      manuallyAdded,
      ingredientType,
      listKind,
      quantities:
        quantities.length > 0
          ? quantities
          : [{ quantity: null, unit: "", note: "" }],
      sources,
      leftoverNote:
        typeof item.leftoverNote === "string" ? item.leftoverNote : null,
    };
  }

  // 旧形式 → quantities / sources へ移行
  const quantity =
    item.quantity === null || typeof item.quantity === "number"
      ? item.quantity
      : null;
  const unit = typeof item.unit === "string" ? item.unit : "";
  const note = typeof item.note === "string" ? item.note : "";

  const recipeIds = Array.isArray(item.sourceRecipeIds)
    ? item.sourceRecipeIds.filter((id): id is string => typeof id === "string")
    : [];
  const mealItemIds = Array.isArray(item.sourceMealItemIds)
    ? item.sourceMealItemIds.filter((id): id is string => typeof id === "string")
    : [];

  const sources: ShoppingItemSource[] = [];
  const maxLen = Math.max(recipeIds.length, mealItemIds.length, 1);
  for (let index = 0; index < maxLen; index += 1) {
    const recipeId = recipeIds[index] ?? recipeIds[0] ?? null;
    const mealItemId = mealItemIds[index] ?? mealItemIds[0] ?? null;
    if (!recipeId && !mealItemId && !manuallyAdded) {
      continue;
    }
    sources.push({
      recipeId,
      recipeName: recipeId ? "（レシピ）" : "手動追加",
      mealItemId,
      date: "",
      quantity,
      unit,
      note,
    });
  }

  return {
    id: item.id,
    ingredientName: item.ingredientName,
    checked,
    manuallyAdded,
    ingredientType,
    listKind,
    quantities: [{ quantity, unit, note }],
    sources,
    leftoverNote: null,
  };
}

function migrateShoppingList(value: unknown): ShoppingList | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.weekStart !== "string" ||
    typeof item.createdAt !== "string" ||
    typeof item.updatedAt !== "string" ||
    !Array.isArray(item.items)
  ) {
    return null;
  }

  const items: ShoppingListItem[] = [];
  for (const raw of item.items) {
    const migrated = migrateShoppingListItem(raw);
    if (migrated === null) {
      return null;
    }
    items.push(migrated);
  }

  return {
    id: item.id,
    weekStart: item.weekStart,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    items,
  };
}

function needsListMigration(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) {
    return true;
  }
  const item = raw as Record<string, unknown>;
  if (!Array.isArray(item.items)) {
    return true;
  }
  return item.items.some((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return true;
    }
    const row = entry as Record<string, unknown>;
    return !Array.isArray(row.quantities) || !Array.isArray(row.sources);
  });
}

function parseAndMigrateLists(value: unknown): {
  lists: ShoppingList[];
  migrated: boolean;
} | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const lists: ShoppingList[] = [];
  let migrated = false;

  for (const item of value) {
    const list = migrateShoppingList(item);
    if (list === null) {
      return null;
    }
    if (needsListMigration(item)) {
      migrated = true;
    }
    lists.push(list);
  }

  return { lists, migrated };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function writeLists(lists: ShoppingList[]): void {
  writeStorage(STORAGE_KEYS.shoppingLists, lists);
  cachedRaw = window.localStorage.getItem(STORAGE_KEYS.shoppingLists);
  cachedLists = lists;
}

function persist(lists: ShoppingList[]): void {
  writeLists(lists);
  notify();
}

export function loadShoppingLists(): ShoppingList[] {
  if (typeof window === "undefined") {
    return [];
  }

  if (!hasStorageKey(STORAGE_KEYS.shoppingLists)) {
    writeLists([]);
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.shoppingLists);
  if (raw === cachedRaw && cachedRaw !== undefined) {
    return cachedLists;
  }

  const stored = readStorage<unknown>(STORAGE_KEYS.shoppingLists);
  const parsed = parseAndMigrateLists(stored);

  if (parsed === null) {
    writeLists([]);
    return [];
  }

  if (parsed.migrated) {
    writeLists(parsed.lists);
    return parsed.lists;
  }

  cachedRaw = raw;
  cachedLists = parsed.lists;
  return parsed.lists;
}

export function subscribeShoppingLists(onStoreChange: Listener): () => void {
  listeners.add(onStoreChange);

  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEYS.shoppingLists || event.key === null) {
      cachedRaw = undefined;
      onStoreChange();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getShoppingListsSnapshot(): ShoppingList[] {
  return loadShoppingLists();
}

/** SSR 用の安定参照（毎回新しい配列を返すと無限ループになる） */
const EMPTY_SHOPPING_LISTS_SNAPSHOT: ShoppingList[] = [];

export function getShoppingListsServerSnapshot(): ShoppingList[] {
  return EMPTY_SHOPPING_LISTS_SNAPSHOT;
}

export function getShoppingListByWeek(weekStart: string): ShoppingList | null {
  return loadShoppingLists().find((list) => list.weekStart === weekStart) ?? null;
}

function saveList(list: ShoppingList): ShoppingList {
  const lists = loadShoppingLists();
  const index = lists.findIndex((entry) => entry.weekStart === list.weekStart);
  const updated: ShoppingList = {
    ...list,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    const next = [...lists];
    next[index] = updated;
    persist(next);
  } else {
    persist([updated, ...lists]);
  }

  return updated;
}

export function createOrRegenerateShoppingList(
  mealPlan: MealPlan,
  recipes: Recipe[],
): ShoppingList {
  const existing = getShoppingListByWeek(mealPlan.weekStart);
  const generated = generateShoppingListFromMealPlan(
    mealPlan,
    recipes,
    existing,
    getActiveLeftoversForProposal("local", mealPlan.weekStart),
    getRecurringForShoppingDeduction(loadRecurringPurchaseIngredients(), "local"),
  );
  return saveList(generated);
}

export function toggleShoppingItemChecked(
  weekStart: string,
  itemId: string,
): ShoppingList | null {
  const list = getShoppingListByWeek(weekStart);
  if (!list) {
    return null;
  }

  return saveList({
    ...list,
    items: list.items.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item,
    ),
  });
}

/**
 * レシート明細の食材名と照合し、買い物リストの未チェック項目を購入済みにする。
 * 正規化名の一致で判定。戻り値はチェックした件数。
 */
export function checkShoppingItemsMatchingNames(
  weekStart: string,
  ingredientNames: string[],
): number {
  const list = getShoppingListByWeek(weekStart);
  if (!list || ingredientNames.length === 0) {
    return 0;
  }

  const keys = new Set(
    ingredientNames
      .map((name) => normalizeIngredientName(name))
      .filter((name) => name.length > 0),
  );
  if (keys.size === 0) {
    return 0;
  }

  let checkedCount = 0;
  const nextItems = list.items.map((item) => {
    if (item.checked) {
      return item;
    }
    const key = normalizeIngredientName(item.ingredientName);
    if (!keys.has(key)) {
      return item;
    }
    checkedCount += 1;
    return { ...item, checked: true };
  });

  if (checkedCount === 0) {
    return 0;
  }

  saveList({ ...list, items: nextItems });
  return checkedCount;
}

/** 常備品の在庫状態変更に合わせて listKind を同期する */
export function updateShoppingItemListKind(
  weekStart: string,
  itemId: string,
  listKind: ShoppingListKind,
): ShoppingList | null {
  const list = getShoppingListByWeek(weekStart);
  if (!list) {
    return null;
  }

  return saveList({
    ...list,
    items: list.items.map((item) =>
      item.id === itemId ? { ...item, listKind } : item,
    ),
  });
}

export function updateShoppingItem(
  weekStart: string,
  itemId: string,
  input: ShoppingListItemInput,
): ShoppingList | null {
  const list = getShoppingListByWeek(weekStart);
  if (!list) {
    return null;
  }

  return saveList({
    ...list,
    items: list.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            ingredientName: input.ingredientName.trim(),
            quantities: [
              {
                quantity: input.quantity,
                unit: input.unit.trim(),
                note: input.note.trim(),
              },
            ],
            ingredientType:
              input.ingredientType ?? item.ingredientType ?? DEFAULT_INGREDIENT_TYPE,
          }
        : item,
    ),
  });
}

export function addManualShoppingItem(
  weekStart: string,
  input: ShoppingListItemInput,
): ShoppingList {
  const existing = getShoppingListByWeek(weekStart);
  const now = new Date().toISOString();
  const list: ShoppingList = existing ?? {
    id: crypto.randomUUID(),
    weekStart,
    createdAt: now,
    updatedAt: now,
    items: [],
  };

  const type = input.ingredientType ?? DEFAULT_INGREDIENT_TYPE;
  const item: ShoppingListItem = {
    id: crypto.randomUUID(),
    ingredientName: input.ingredientName.trim(),
    checked: false,
    manuallyAdded: true,
    ingredientType: type,
    listKind: "buy",
    quantities: [
      {
        quantity: input.quantity,
        unit: input.unit.trim(),
        note: input.note.trim(),
      },
    ],
    sources: [],
  };

  // 同名の手動追加があればマージ
  const key = normalizeIngredientName(item.ingredientName);
  const existingIndex = list.items.findIndex(
    (entry) =>
      entry.manuallyAdded &&
      normalizeIngredientName(entry.ingredientName) === key,
  );

  if (existingIndex >= 0) {
    const previous = list.items[existingIndex];
    const nextItems = [...list.items];
    nextItems[existingIndex] = {
      ...previous,
      quantities: [...previous.quantities, ...item.quantities],
    };
    return saveList({ ...list, items: nextItems });
  }

  return saveList({
    ...list,
    items: [...list.items, item],
  });
}

export function removeShoppingItem(
  weekStart: string,
  itemId: string,
): ShoppingList | null {
  const list = getShoppingListByWeek(weekStart);
  if (!list) {
    return null;
  }

  return saveList({
    ...list,
    items: list.items.filter((item) => item.id !== itemId),
  });
}

export function removeCheckedShoppingItems(
  weekStart: string,
): ShoppingList | null {
  const list = getShoppingListByWeek(weekStart);
  if (!list) {
    return null;
  }

  return saveList({
    ...list,
    items: list.items.filter((item) => !item.checked),
  });
}

export function partitionShoppingItems(items: ShoppingListItem[]): {
  buy: ShoppingListItem[];
  pantryCheck: ShoppingListItem[];
  purchased: ShoppingListItem[];
} {
  const buy: ShoppingListItem[] = [];
  const pantryCheck: ShoppingListItem[] = [];
  const purchased: ShoppingListItem[] = [];

  for (const item of items) {
    if (item.checked) {
      purchased.push(item);
      continue;
    }
    if (item.listKind === "pantryCheck") {
      pantryCheck.push(item);
    } else {
      buy.push(item);
    }
  }

  const byName = (left: ShoppingListItem, right: ShoppingListItem) =>
    left.ingredientName.localeCompare(right.ingredientName, "ja");

  return {
    buy: buy.sort(byName),
    pantryCheck: pantryCheck.sort(byName),
    purchased: purchased.sort(byName),
  };
}

/** @deprecated partitionShoppingItems を利用 */
export function sortShoppingItems(items: ShoppingListItem[]): ShoppingListItem[] {
  const parts = partitionShoppingItems(items);
  return [...parts.buy, ...parts.pantryCheck, ...parts.purchased];
}

/** repository / 同期用 */
export function replaceShoppingLists(lists: ShoppingList[]): void {
  persist(lists);
}
