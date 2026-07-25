import type { RecipeStep, RecipeStepInput } from "@/types/recipe";

function isRecipeStep(value: unknown): value is RecipeStep {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.order === "number" &&
    Number.isInteger(item.order) &&
    typeof item.text === "string"
  );
}

/** 手順を order 順に並べ、order を 1 から振り直す */
export function normalizeSteps(steps: RecipeStep[]): RecipeStep[] {
  return [...steps]
    .sort((left, right) => left.order - right.order)
    .map((step, index) => ({
      ...step,
      order: index + 1,
      text: step.text.trim(),
    }))
    .filter((step) => step.text !== "");
}

/**
 * 旧 instructions 文字列や不完全な steps を RecipeStep[] に変換する。
 */
export function migrateSteps(
  stepsValue: unknown,
  legacyInstructions: unknown,
): RecipeStep[] {
  if (Array.isArray(stepsValue)) {
    const normalized = normalizeSteps(stepsValue.filter(isRecipeStep));
    // 有効な手順があるときだけ採用。空なら旧 instructions へフォールバック
    if (normalized.length > 0) {
      return normalized;
    }
  }

  if (typeof legacyInstructions === "string") {
    const text = legacyInstructions.trim();
    if (text !== "") {
      return [
        {
          id: crypto.randomUUID(),
          order: 1,
          text,
        },
      ];
    }
  }

  return [];
}

/** フォーム入力を保存用 steps に変換（空行は除外） */
export function toRecipeSteps(inputs: RecipeStepInput[]): RecipeStep[] {
  return inputs
    .map((input) => input.text.trim())
    .filter((text) => text !== "")
    .map((text, index) => ({
      id: crypto.randomUUID(),
      order: index + 1,
      text,
    }));
}

export function hasValidStepsArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isRecipeStep);
}
