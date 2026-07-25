import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItemById,
  loadInventory,
  replaceInventory,
  updateInventoryItem,
} from "@/lib/inventory";
import { getOrCreateMealPlan, loadMealPlans, replaceMealPlans } from "@/lib/meal-plans";
import {
  addManualShoppingItem,
  getShoppingListByWeek,
  loadShoppingLists,
  removeCheckedShoppingItems,
  removeShoppingItem,
  replaceShoppingLists,
  toggleShoppingItemChecked,
  updateShoppingItem,
} from "@/lib/shopping-lists";
import {
  loadPantryStock,
  replacePantryStock,
  setPantryStockStatus,
  upsertPantryStock,
} from "@/lib/pantry-stock";
import { createLocalRecipeRepository } from "@/lib/repositories/local/recipe-repository";
import type {
  AppRepositories,
  InventoryRepository,
  MealPlanRepository,
  PantryRepository,
  ShoppingListRepository,
} from "@/lib/repositories/types";
import type { MealPlan } from "@/types/meal-plan";
import type { ShoppingList } from "@/types/shopping-list";
import type { InventoryItem } from "@/types/inventory";
import type { PantryStockItem } from "@/types/pantry-stock";

function createLocalMealPlanRepository(): MealPlanRepository {
  return {
    async list() {
      return loadMealPlans();
    },
    async getByWeek(weekStart) {
      return getOrCreateMealPlan(weekStart);
    },
    async save(plan) {
      const plans = loadMealPlans();
      const index = plans.findIndex((item) => item.weekStart === plan.weekStart);
      const nextPlan: MealPlan = {
        ...plan,
        updatedAt: new Date().toISOString(),
      };
      const next =
        index >= 0
          ? plans.map((item, i) => (i === index ? nextPlan : item))
          : [nextPlan, ...plans];
      replaceMealPlans(next);
      return nextPlan;
    },
  };
}

function createLocalShoppingListRepository(): ShoppingListRepository {
  return {
    async list() {
      return loadShoppingLists();
    },
    async getByWeek(weekStart) {
      return getShoppingListByWeek(weekStart);
    },
    async save(list) {
      const lists = loadShoppingLists();
      const index = lists.findIndex((item) => item.weekStart === list.weekStart);
      const nextList: ShoppingList = {
        ...list,
        updatedAt: new Date().toISOString(),
      };
      const next =
        index >= 0
          ? lists.map((item, i) => (i === index ? nextList : item))
          : [nextList, ...lists];
      replaceShoppingLists(next);
      return nextList;
    },
    async toggleChecked(weekStart, itemId) {
      return toggleShoppingItemChecked(weekStart, itemId);
    },
    async addManual(weekStart, input) {
      return addManualShoppingItem(weekStart, input);
    },
    async updateItem(weekStart, itemId, input) {
      return updateShoppingItem(weekStart, itemId, input);
    },
    async removeItem(weekStart, itemId) {
      return removeShoppingItem(weekStart, itemId);
    },
    async removeChecked(weekStart) {
      return removeCheckedShoppingItems(weekStart);
    },
  };
}

function createLocalInventoryRepository(): InventoryRepository {
  return {
    async list() {
      return loadInventory();
    },
    async getById(id) {
      return getInventoryItemById(id);
    },
    async create(input) {
      return createInventoryItem(input);
    },
    async update(id, input) {
      return updateInventoryItem(id, input);
    },
    async delete(id) {
      return deleteInventoryItem(id);
    },
    async importItems(items) {
      const current = loadInventory();
      const ids = new Set(current.map((item) => item.id));
      let imported = 0;
      let skipped = 0;
      const next: InventoryItem[] = [...current];
      for (const item of items) {
        if (ids.has(item.id)) {
          skipped += 1;
          continue;
        }
        next.unshift(item);
        ids.add(item.id);
        imported += 1;
      }
      replaceInventory(next);
      return { imported, skipped };
    },
  };
}

function createLocalPantryRepository(): PantryRepository {
  return {
    async list() {
      return loadPantryStock();
    },
    async upsert(input) {
      return upsertPantryStock(input);
    },
    async setStatus(name, stockStatus, ingredientType) {
      return setPantryStockStatus(name, stockStatus, ingredientType);
    },
    async importItems(items) {
      const current = loadPantryStock();
      const keys = new Set(current.map((item) => item.key));
      let imported = 0;
      let skipped = 0;
      const next: PantryStockItem[] = [...current];
      for (const item of items) {
        if (keys.has(item.key)) {
          skipped += 1;
          continue;
        }
        next.unshift(item);
        keys.add(item.key);
        imported += 1;
      }
      replacePantryStock(next);
      return { imported, skipped };
    },
  };
}

export function createLocalRepositories(): AppRepositories {
  return {
    recipes: createLocalRecipeRepository(),
    mealPlans: createLocalMealPlanRepository(),
    shoppingLists: createLocalShoppingListRepository(),
    inventory: createLocalInventoryRepository(),
    pantry: createLocalPantryRepository(),
    household: null,
  };
}
