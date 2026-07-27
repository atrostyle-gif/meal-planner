"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  RecipeStepsEditor,
  stepsToDrafts,
  type StepDraft,
} from "@/components/recipes/RecipeStepsEditor";
import { RecipeNutritionAutoSection } from "@/components/recipes/RecipeNutritionAutoSection";
import { findIngredientTypeByName } from "@/lib/ingredient-type-lookup";
import { useRecipes } from "@/lib/use-recipes";
import { loadFamilyMemberProfiles } from "@/lib/family-member-profiles";
import { emptyRecipeCookingProfile } from "@/lib/cooking-suitability";
import {
  buildAutoNutritionPreview,
  type AutoNutritionPreview,
} from "@/lib/nutrition/recipe-auto-estimate";
import {
  SUITABILITY_LEVELS,
  SUITABILITY_LABELS,
  type SuitabilityLevel,
} from "@/types/weekly-lifestyle";
import {
  DEFAULT_INGREDIENT_TYPE,
  DEFAULT_RECIPE_CATEGORY,
  DEFAULT_RECIPE_COURSE,
  DEFAULT_SERVINGS,
  INGREDIENT_TYPES,
  INGREDIENT_TYPE_LABELS,
  INGREDIENT_UNITS,
  RECIPE_CATEGORIES,
  RECIPE_COURSES,
  type IngredientInput,
  type IngredientType,
  type ProteinType,
  type Recipe,
  type RecipeCategory,
  type RecipeCourse,
  type RecipeInput,
  type RecipeSeason,
} from "@/types/recipe";

type IngredientDraft = {
  key: string;
  name: string;
  quantityText: string;
  unit: string;
  note: string;
  ingredientType: IngredientType;
};

type RecipeFormProps = {
  initialRecipe?: Recipe;
  submitLabel: string;
  onSubmit: (input: RecipeInput) => void;
  onDelete?: () => void;
};

function emptyDraft(): IngredientDraft {
  return {
    key: crypto.randomUUID(),
    name: "",
    quantityText: "",
    unit: "",
    note: "",
    ingredientType: DEFAULT_INGREDIENT_TYPE,
  };
}

function toDrafts(recipe?: Recipe): IngredientDraft[] {
  if (!recipe || recipe.ingredients.length === 0) {
    return [emptyDraft()];
  }

  return recipe.ingredients.map((item) => ({
    key: item.id,
    name: item.name,
    quantityText: item.quantity === null ? "" : String(item.quantity),
    unit: item.unit,
    note: item.note,
    ingredientType: item.ingredientType ?? DEFAULT_INGREDIENT_TYPE,
  }));
}

function parseQuantityText(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RecipeForm({
  initialRecipe,
  submitLabel,
  onSubmit,
  onDelete,
}: RecipeFormProps) {
  const recipes = useRecipes();
  const [name, setName] = useState(initialRecipe?.name ?? "");
  const [category, setCategory] = useState<RecipeCategory>(
    initialRecipe?.category ?? DEFAULT_RECIPE_CATEGORY,
  );
  const [course, setCourse] = useState<RecipeCourse>(
    initialRecipe?.course ?? DEFAULT_RECIPE_COURSE,
  );
  const [tags, setTags] = useState<string[]>(initialRecipe?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [servingsText, setServingsText] = useState(
    String(initialRecipe?.servings ?? DEFAULT_SERVINGS),
  );
  const [cookingTimeText, setCookingTimeText] = useState(
    initialRecipe?.cookingTimeMinutes == null
      ? ""
      : String(initialRecipe.cookingTimeMinutes),
  );
  const [caloriesText, setCaloriesText] = useState(
    initialRecipe?.calories == null ? "" : String(initialRecipe.calories),
  );
  const [proteinText, setProteinText] = useState(
    initialRecipe?.protein == null ? "" : String(initialRecipe.protein),
  );
  const [fatText, setFatText] = useState(
    initialRecipe?.fat == null ? "" : String(initialRecipe.fat),
  );
  const [carbsText, setCarbsText] = useState(
    initialRecipe?.carbohydrates == null
      ? ""
      : String(initialRecipe.carbohydrates),
  );
  const [saltText, setSaltText] = useState(
    initialRecipe?.salt == null ? "" : String(initialRecipe.salt),
  );
  const [vegetablesText, setVegetablesText] = useState(
    initialRecipe?.vegetables == null ? "" : String(initialRecipe.vegetables),
  );
  const [proteinType, setProteinType] = useState<ProteinType | "">(
    initialRecipe?.proteinType ?? "",
  );
  const [season, setSeason] = useState<RecipeSeason | "">(
    initialRecipe?.season ?? "",
  );
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    toDrafts(initialRecipe),
  );
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    stepsToDrafts(initialRecipe?.steps ?? []),
  );
  const [memo, setMemo] = useState(initialRecipe?.memo ?? "");
  const [cookingProfile, setCookingProfile] = useState(
    initialRecipe?.cookingProfile ?? emptyRecipeCookingProfile(),
  );
  const [error, setError] = useState<string | null>(null);
  const [showManualNutrition, setShowManualNutrition] = useState(false);
  const [nutritionPreview, setNutritionPreview] =
    useState<AutoNutritionPreview | null>(null);
  const [calculatingNutrition, setCalculatingNutrition] = useState(false);

  const runAutoNutrition = useCallback((): AutoNutritionPreview => {
    const servings = Number(servingsText);
    const safeServings =
      Number.isInteger(servings) && servings >= 1 ? servings : DEFAULT_SERVINGS;
    let cookingTimeMinutes: number | null = null;
    if (cookingTimeText.trim() !== "") {
      const parsed = Number(cookingTimeText);
      if (Number.isInteger(parsed) && parsed >= 0) {
        cookingTimeMinutes = parsed;
      }
    }
    const stepCount = steps.filter((step) => step.text.trim() !== "").length;
    return buildAutoNutritionPreview({
      ingredients: ingredients.map((item) => ({
        name: item.name,
        quantity: parseQuantityText(item.quantityText),
        unit: item.unit,
        quantityText: item.quantityText,
      })),
      servings: safeServings,
      stepCount,
      cookingTimeMinutes,
    });
  }, [cookingTimeText, ingredients, servingsText, steps]);

  const syncManualFieldsFromPreview = useCallback(
    (preview: AutoNutritionPreview): void => {
      setCaloriesText(
        preview.caloriesKcal == null ? "" : String(preview.caloriesKcal),
      );
      setProteinText(
        preview.proteinG == null ? "" : String(preview.proteinG),
      );
      setFatText(preview.fatG == null ? "" : String(preview.fatG));
      setCarbsText(
        preview.carbohydratesG == null ? "" : String(preview.carbohydratesG),
      );
      setSaltText(
        preview.saltEquivalentG == null
          ? ""
          : String(preview.saltEquivalentG),
      );
      setVegetablesText(
        preview.vegetablesG == null ? "" : String(preview.vegetablesG),
      );
    },
    [],
  );

  const handleRecalculateNutrition = useCallback(() => {
    setCalculatingNutrition(true);
    try {
      const preview = runAutoNutrition();
      setNutritionPreview(preview);
      if (!showManualNutrition) {
        syncManualFieldsFromPreview(preview);
      }
    } finally {
      setCalculatingNutrition(false);
    }
  }, [runAutoNutrition, showManualNutrition, syncManualFieldsFromPreview]);

  // 材料・人数・手順・時間が変わったら表示用に再計算
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const preview = runAutoNutrition();
      setNutritionPreview(preview);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [runAutoNutrition]);

  function updateIngredient(
    key: string,
    field: keyof Omit<IngredientDraft, "key" | "ingredientType">,
    value: string,
  ): void {
    setIngredients((current) =>
      current.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    );
  }

  function updateIngredientType(key: string, ingredientType: IngredientType): void {
    setIngredients((current) =>
      current.map((item) =>
        item.key === key ? { ...item, ingredientType } : item,
      ),
    );
  }

  /** 同名食材の既存区分があれば初期値として反映 */
  function applyKnownIngredientType(key: string, ingredientName: string): void {
    const known = findIngredientTypeByName(ingredientName, recipes);
    if (known === DEFAULT_INGREDIENT_TYPE) {
      return;
    }
    setIngredients((current) =>
      current.map((item) => {
        if (item.key !== key) {
          return item;
        }
        // ユーザーが既に変更済みなら上書きしない
        if (item.ingredientType !== DEFAULT_INGREDIENT_TYPE) {
          return item;
        }
        return { ...item, ingredientType: known };
      }),
    );
  }

  function addIngredient(): void {
    setIngredients((current) => [...current, emptyDraft()]);
  }

  function removeIngredient(key: string): void {
    setIngredients((current) => {
      if (current.length <= 1) {
        return [emptyDraft()];
      }
      return current.filter((item) => item.key !== key);
    });
  }

  function addTag(): void {
    const trimmed = tagDraft.trim();
    if (trimmed === "") {
      return;
    }
    setTags((current) => (current.includes(trimmed) ? current : [...current, trimmed]));
    setTagDraft("");
  }

  function removeTag(tag: string): void {
    setTags((current) => current.filter((item) => item !== tag));
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (name.trim() === "") {
      setError("料理名を入力してください。");
      return;
    }

    const servings = Number(servingsText);
    if (!Number.isInteger(servings) || servings < 1) {
      setError("何人分は1以上の整数で入力してください。");
      return;
    }

    let cookingTimeMinutes: number | null = null;
    if (cookingTimeText.trim() !== "") {
      const parsed = Number(cookingTimeText);
      if (!Number.isInteger(parsed) || parsed < 0) {
        setError("調理時間は0以上の整数（分）で入力してください。");
        return;
      }
      cookingTimeMinutes = parsed;
    }

    function parseOptionalNumber(
      text: string,
      label: string,
    ): number | null | undefined {
      if (text.trim() === "") {
        return null;
      }
      const parsed = Number(text);
      if (!Number.isFinite(parsed)) {
        setError(`${label}は数値で入力してください。`);
        return undefined;
      }
      return parsed;
    }

    for (const item of ingredients) {
      if (item.name.trim() === "") {
        continue;
      }
      if (
        item.quantityText.trim() !== "" &&
        parseQuantityText(item.quantityText) === null
      ) {
        setError(`「${item.name}」の数量は数値で入力してください。`);
        return;
      }
    }

    const ingredientInputs: IngredientInput[] = ingredients.map((item) => ({
      name: item.name,
      quantity: parseQuantityText(item.quantityText),
      unit: item.unit,
      note: item.note,
      ingredientType: item.ingredientType,
    }));

    const auto = runAutoNutrition();
    setNutritionPreview(auto);

    let calories: number | null = auto.caloriesKcal;
    let protein: number | null = auto.proteinG;
    let fat: number | null = auto.fatG;
    let carbohydrates: number | null = auto.carbohydratesG;
    let salt: number | null = auto.saltEquivalentG;
    let vegetables: number | null = auto.vegetablesG;
    let calculationSource: RecipeInput["calculationSource"] = "automatic";

    if (showManualNutrition) {
      const manualCalories = parseOptionalNumber(caloriesText, "カロリー");
      if (manualCalories === undefined) return;
      const manualProtein = parseOptionalNumber(proteinText, "たんぱく質");
      if (manualProtein === undefined) return;
      const manualFat = parseOptionalNumber(fatText, "脂質");
      if (manualFat === undefined) return;
      const manualCarbs = parseOptionalNumber(carbsText, "炭水化物");
      if (manualCarbs === undefined) return;
      const manualSalt = parseOptionalNumber(saltText, "塩分");
      if (manualSalt === undefined) return;
      const manualVegetables = parseOptionalNumber(vegetablesText, "野菜量");
      if (manualVegetables === undefined) return;

      const hasManual =
        manualCalories != null ||
        manualProtein != null ||
        manualFat != null ||
        manualCarbs != null ||
        manualSalt != null ||
        manualVegetables != null;

      calories = manualCalories ?? calories;
      protein = manualProtein ?? protein;
      fat = manualFat ?? fat;
      carbohydrates = manualCarbs ?? carbohydrates;
      salt = manualSalt ?? salt;
      vegetables = manualVegetables ?? vegetables;
      calculationSource = hasManual ? "mixed" : "automatic";
    }

    setError(null);
    onSubmit({
      name,
      category,
      course,
      tags,
      servings,
      cookingTimeMinutes,
      calories,
      protein,
      fat,
      carbohydrates,
      salt,
      vegetables,
      nutritionStatus: auto.nutritionStatus,
      caloriesKcal: calories,
      proteinG: protein,
      fatG: fat,
      carbohydratesG: carbohydrates,
      saltEquivalentG: salt,
      dietaryFiberG: auto.dietaryFiberG,
      nutritionCoverage: auto.nutritionCoverage,
      calculationSource,
      proteinType: proteinType === "" ? null : proteinType,
      season: season === "" ? null : season,
      // 難易度・健康スコアは自動。好みは学習用のため登録時は触らない
      difficulty: auto.difficulty,
      favoriteScore: initialRecipe?.favoriteScore ?? null,
      healthyScore: auto.healthyScore,
      ingredients: ingredientInputs,
      steps: steps.map((step) => ({ text: step.text })),
      memo,
      cookingProfile: {
        ...cookingProfile,
        activeCookingMinutes:
          cookingProfile.activeCookingMinutes ?? cookingTimeMinutes,
        totalCookingMinutes:
          cookingProfile.totalCookingMinutes ?? cookingTimeMinutes,
        stepCount:
          cookingProfile.stepCount ??
          steps.filter((step) => step.text.trim() !== "").length,
        source: cookingProfile.source === "manual" ? "manual" : "estimated",
      },
      importMethod: initialRecipe?.importMethod,
      source: initialRecipe?.source,
      mealAffinity: initialRecipe?.mealAffinity,
      extractionWarnings: initialRecipe?.extractionWarnings,
    });
  }

  function handleDelete(): void {
    if (!onDelete) {
      return;
    }

    const confirmed = window.confirm(`「${name || "このレシピ"}」を削除しますか？`);
    if (confirmed) {
      onDelete();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-on-surface">料理名（必須）</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-xl border-0 bg-surface-container px-4 py-3 text-base text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          placeholder="例: 鶏の照り焼き"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-on-surface">カテゴリー</span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as RecipeCategory)}
          className="w-full rounded-xl border-0 bg-surface-container px-4 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
        >
          {RECIPE_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-on-surface">料理区分</span>
        <select
          value={course}
          onChange={(event) => setCourse(event.target.value as RecipeCourse)}
          className="w-full rounded-xl border-0 bg-surface-container px-4 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
        >
          {RECIPE_COURSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-on-surface">何人分</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={servingsText}
            onChange={(event) => setServingsText(event.target.value)}
            className="w-full rounded-xl border-0 bg-surface-container px-4 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-on-surface">調理時間（分）</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={cookingTimeText}
            onChange={(event) => setCookingTimeText(event.target.value)}
            className="w-full rounded-xl border-0 bg-surface-container px-4 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
            placeholder="未入力可"
          />
        </label>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-on-surface">タグ</legend>
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-3 py-1.5 text-sm text-on-secondary-container"
                  aria-label={`${tag}を削除`}
                >
                  {tag}
                  <span aria-hidden>×</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">タグはまだありません</p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={handleTagKeyDown}
            className="min-w-0 flex-1 rounded-xl border-0 bg-surface-container px-3 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
            placeholder="例: 簡単"
          />
          <button
            type="button"
            onClick={addTag}
            className="shrink-0 rounded-xl bg-surface-container px-4 py-3 text-sm font-medium text-primary ring-1 ring-outline-variant"
          >
            追加
          </button>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-on-surface">材料</legend>
        <div className="space-y-4">
          {ingredients.map((item, index) => (
            <div
              key={item.key}
              className="space-y-2 rounded-2xl bg-surface-container-lowest p-3 ring-1 ring-outline-variant"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-on-surface-variant">
                  材料 {index + 1}
                </p>
                <button
                  type="button"
                  onClick={() => removeIngredient(item.key)}
                  className="rounded-xl px-2 py-1 text-sm text-error hover:bg-error-container"
                  aria-label="材料を削除"
                >
                  削除
                </button>
              </div>

              <input
                type="text"
                value={item.name}
                onChange={(event) =>
                  updateIngredient(item.key, "name", event.target.value)
                }
                onBlur={() => applyKnownIngredientType(item.key, item.name)}
                className="w-full rounded-xl border-0 bg-surface-container px-3 py-2.5 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                placeholder="食材名"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={item.quantityText}
                  onChange={(event) =>
                    updateIngredient(item.key, "quantityText", event.target.value)
                  }
                  className="w-full rounded-xl border-0 bg-surface-container px-3 py-2.5 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                  placeholder="数量"
                />
                <input
                  type="text"
                  list="ingredient-unit-options"
                  value={item.unit}
                  onChange={(event) =>
                    updateIngredient(item.key, "unit", event.target.value)
                  }
                  className="w-full rounded-xl border-0 bg-surface-container px-3 py-2.5 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                  placeholder="単位"
                />
              </div>

              <input
                type="text"
                value={item.note}
                onChange={(event) =>
                  updateIngredient(item.key, "note", event.target.value)
                }
                className="w-full rounded-xl border-0 bg-surface-container px-3 py-2.5 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                placeholder="メモ（任意）"
              />

              <label className="block space-y-1">
                <span className="text-xs font-medium text-on-surface-variant">
                  在庫区分
                </span>
                <select
                  value={item.ingredientType}
                  onChange={(event) =>
                    updateIngredientType(
                      item.key,
                      event.target.value as IngredientType,
                    )
                  }
                  className="w-full rounded-xl border-0 bg-surface-container px-3 py-2.5 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                >
                  {INGREDIENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {INGREDIENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>

        <datalist id="ingredient-unit-options">
          {INGREDIENT_UNITS.map((unit) => (
            <option key={unit} value={unit} />
          ))}
        </datalist>

        <button
          type="button"
          onClick={addIngredient}
          className="text-sm font-medium text-primary"
        >
          ＋ 材料を追加
        </button>
      </fieldset>

      <RecipeStepsEditor steps={steps} onChange={setSteps} />

      <RecipeNutritionAutoSection
        preview={nutritionPreview}
        calculating={calculatingNutrition}
        showManual={showManualNutrition}
        onRecalculate={handleRecalculateNutrition}
        onToggleManual={() => setShowManualNutrition((value) => !value)}
        caloriesText={caloriesText}
        proteinText={proteinText}
        fatText={fatText}
        carbsText={carbsText}
        saltText={saltText}
        vegetablesText={vegetablesText}
        setCaloriesText={setCaloriesText}
        setProteinText={setProteinText}
        setFatText={setFatText}
        setCarbsText={setCarbsText}
        setSaltText={setSaltText}
        setVegetablesText={setVegetablesText}
        proteinType={proteinType}
        season={season}
        setProteinType={setProteinType}
        setSeason={setSeason}
      />

      <fieldset className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <legend className="px-1 text-sm font-medium text-on-surface">作る人・作りやすさ</legend>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="flex gap-2"><input type="checkbox" checked={cookingProfile.beginnerFriendly === true} onChange={(e) => setCookingProfile((p) => ({ ...p, beginnerFriendly: e.target.checked }))} />初心者向け</label>
          <label className="flex gap-2"><input type="checkbox" checked={cookingProfile.requiresDeepFrying === true} onChange={(e) => setCookingProfile((p) => ({ ...p, requiresDeepFrying: e.target.checked }))} />揚げ物あり</label>
          <label className="text-xs">工程数<input type="number" min="0" value={cookingProfile.stepCount ?? ""} onChange={(e) => setCookingProfile((p) => ({ ...p, stepCount: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1 w-full rounded-lg bg-surface-container p-2 text-sm" /></label>
          <label className="text-xs">洗い物<select value={cookingProfile.cleanupLevel ?? ""} onChange={(e) => setCookingProfile((p) => ({ ...p, cleanupLevel: e.target.value === "" ? null : e.target.value as typeof p.cleanupLevel }))} className="mt-1 w-full rounded-lg bg-surface-container p-2 text-sm"><option value="">未設定</option><option value="low">少ない</option><option value="medium">普通</option><option value="high">多い</option></select></label>
          <label className="flex gap-2"><input type="checkbox" checked={cookingProfile.makeAheadSuitable === true} onChange={(e) => setCookingProfile((p) => ({ ...p, makeAheadSuitable: e.target.checked }))} />作り置き・事前準備向き</label>
        </div>
        <div className="space-y-2 text-sm">{loadFamilyMemberProfiles().map((member) => {
          const entry = cookingProfile.memberSuitability.find((item) => item.memberId === member.id);
          const assigned = cookingProfile.assignedCookMemberIds.includes(member.id);
          return <div key={member.id} className="flex items-center gap-2"><label className="flex gap-1"><input type="checkbox" checked={assigned} onChange={() => setCookingProfile((p) => ({ ...p, assignedCookMemberIds: assigned ? p.assignedCookMemberIds.filter((id) => id !== member.id) : [...p.assignedCookMemberIds, member.id] }))} />{member.displayName}</label><select value={entry?.suitability ?? ""} onChange={(e) => setCookingProfile((p) => ({ ...p, memberSuitability: e.target.value === "" ? p.memberSuitability.filter((item) => item.memberId !== member.id) : [...p.memberSuitability.filter((item) => item.memberId !== member.id), { memberId: member.id, suitability: e.target.value as SuitabilityLevel, source: "manual" }] }))} className="rounded-lg bg-surface-container p-1 text-xs"><option value="">適性未設定</option>{SUITABILITY_LEVELS.map((level) => <option key={level} value={level}>{SUITABILITY_LABELS[level]}</option>)}</select></div>;
        })}</div>
      </fieldset>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-on-surface">メモ（任意）</span>
        <textarea
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          rows={3}
          className="w-full resize-y rounded-xl border-0 bg-surface-container px-4 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          placeholder="家族へのメモなど"
        />
      </label>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <div className="space-y-3 pt-2">
        <button
          type="submit"
          className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary shadow-sm"
        >
          {submitLabel}
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full rounded-2xl px-4 py-3.5 text-base font-medium text-error hover:bg-error-container"
          >
            レシピを削除
          </button>
        ) : null}
      </div>
    </form>
  );
}
