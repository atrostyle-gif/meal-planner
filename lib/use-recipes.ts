"use client";

import { useSyncExternalStore } from "react";
import {
  getRecipesServerSnapshot,
  getRecipesSnapshot,
  subscribeRecipes,
} from "@/lib/recipes";
import type { Recipe } from "@/types/recipe";

/** localStorage 上のレシピ一覧を購読する */
export function useRecipes(): Recipe[] {
  return useSyncExternalStore(
    subscribeRecipes,
    getRecipesSnapshot,
    getRecipesServerSnapshot,
  );
}

/** 指定 ID のレシピを取得する */
export function useRecipe(id: string): Recipe | null {
  const recipes = useRecipes();
  return recipes.find((recipe) => recipe.id === id) ?? null;
}
