import type {
  Household,
  HouseholdInvite,
  HouseholdMember,
  Profile,
} from "@/types/household";
import type { InventoryInput, InventoryItem } from "@/types/inventory";
import type { MealPlan } from "@/types/meal-plan";
import type { PantryStockItem } from "@/types/pantry-stock";
import type { Recipe, RecipeInput } from "@/types/recipe";
import type {
  ShoppingList,
  ShoppingListItemInput,
} from "@/types/shopping-list";
import type { IngredientType, StockStatus } from "@/types/ingredient-meta";

export type ConflictError = {
  code: "conflict";
  message: string;
  currentUpdatedAt: string;
};

export type RecipeRepository = {
  list(): Promise<Recipe[]>;
  getById(id: string): Promise<Recipe | null>;
  create(input: RecipeInput, options?: { isSample?: boolean; id?: string }): Promise<Recipe>;
  update(
    id: string,
    input: RecipeInput,
    options?: { expectedUpdatedAt?: string; force?: boolean },
  ): Promise<Recipe>;
  delete(id: string): Promise<boolean>;
  removeSamples(): Promise<number>;
  importRecipes(recipes: Recipe[]): Promise<{ imported: number; skipped: number }>;
};

export type MealPlanRepository = {
  list(): Promise<MealPlan[]>;
  getByWeek(weekStart: string): Promise<MealPlan | null>;
  save(plan: MealPlan, options?: { expectedUpdatedAt?: string; force?: boolean }): Promise<MealPlan>;
};

export type ShoppingListRepository = {
  list(): Promise<ShoppingList[]>;
  getByWeek(weekStart: string): Promise<ShoppingList | null>;
  save(list: ShoppingList, options?: { expectedUpdatedAt?: string; force?: boolean }): Promise<ShoppingList>;
  toggleChecked(weekStart: string, itemId: string): Promise<ShoppingList | null>;
  addManual(weekStart: string, input: ShoppingListItemInput): Promise<ShoppingList>;
  updateItem(
    weekStart: string,
    itemId: string,
    input: ShoppingListItemInput,
  ): Promise<ShoppingList | null>;
  removeItem(weekStart: string, itemId: string): Promise<ShoppingList | null>;
  removeChecked(weekStart: string): Promise<ShoppingList | null>;
};

export type InventoryRepository = {
  list(): Promise<InventoryItem[]>;
  getById(id: string): Promise<InventoryItem | null>;
  create(input: InventoryInput): Promise<InventoryItem>;
  update(id: string, input: InventoryInput): Promise<InventoryItem | null>;
  delete(id: string): Promise<boolean>;
  importItems(items: InventoryItem[]): Promise<{ imported: number; skipped: number }>;
};

export type PantryRepository = {
  list(): Promise<PantryStockItem[]>;
  upsert(input: {
    displayName: string;
    ingredientType: IngredientType;
    stockStatus: StockStatus;
  }): Promise<PantryStockItem | null>;
  setStatus(
    name: string,
    stockStatus: StockStatus,
    ingredientType?: IngredientType,
  ): Promise<PantryStockItem | null>;
  importItems(items: PantryStockItem[]): Promise<{ imported: number; skipped: number }>;
};

export type HouseholdRepository = {
  getMyProfile(): Promise<Profile | null>;
  updateDisplayName(displayName: string): Promise<Profile>;
  getMyHousehold(): Promise<Household | null>;
  listMembers(): Promise<HouseholdMember[]>;
  createHousehold(name: string, displayName: string): Promise<string>;
  createInvite(expiresHours?: number): Promise<HouseholdInvite>;
  joinWithInvite(code: string, displayName?: string): Promise<string>;
};

export type AppRepositories = {
  recipes: RecipeRepository;
  mealPlans: MealPlanRepository;
  shoppingLists: ShoppingListRepository;
  inventory: InventoryRepository;
  pantry: PantryRepository;
  household: HouseholdRepository | null;
};
