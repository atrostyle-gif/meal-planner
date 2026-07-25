"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import {
  RecipeStepsEditor,
  stepsToDrafts,
  type StepDraft,
} from "@/components/recipes/RecipeStepsEditor";
import { findIngredientTypeByName } from "@/lib/ingredient-type-lookup";
import { useRecipes } from "@/lib/use-recipes";
import { loadFamilyMemberProfiles } from "@/lib/family-member-profiles";
import { emptyRecipeCookingProfile } from "@/lib/cooking-suitability";
import { SUITABILITY_LEVELS, SUITABILITY_LABELS, type SuitabilityLevel } from "@/types/weekly-lifestyle";
import {
  DEFAULT_INGREDIENT_TYPE,
  DEFAULT_RECIPE_CATEGORY,
  DEFAULT_RECIPE_COURSE,
  DEFAULT_SERVINGS,
  INGREDIENT_TYPES,
  INGREDIENT_TYPE_LABELS,
  INGREDIENT_UNITS,
  PROTEIN_TYPES,
  RECIPE_CATEGORIES,
  RECIPE_COURSES,
  RECIPE_SEASONS,
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
  const [difficultyText, setDifficultyText] = useState(
    initialRecipe?.difficulty == null ? "" : String(initialRecipe.difficulty),
  );
  const [favoriteText, setFavoriteText] = useState(
    initialRecipe?.favoriteScore == null
      ? ""
      : String(initialRecipe.favoriteScore),
  );
  const [healthyText, setHealthyText] = useState(
    initialRecipe?.healthyScore == null
      ? ""
      : String(initialRecipe.healthyScore),
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

    const calories = parseOptionalNumber(caloriesText, "カロリー");
    if (calories === undefined) {
      return;
    }
    const protein = parseOptionalNumber(proteinText, "たんぱく質");
    if (protein === undefined) {
      return;
    }
    const fat = parseOptionalNumber(fatText, "脂質");
    if (fat === undefined) {
      return;
    }
    const carbohydrates = parseOptionalNumber(carbsText, "炭水化物");
    if (carbohydrates === undefined) {
      return;
    }
    const salt = parseOptionalNumber(saltText, "塩分");
    if (salt === undefined) {
      return;
    }
    const vegetables = parseOptionalNumber(vegetablesText, "野菜量");
    if (vegetables === undefined) {
      return;
    }

    let difficulty: number | null = null;
    if (difficultyText.trim() !== "") {
      const parsed = Number(difficultyText);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
        setError("難易度は1〜5の整数で入力してください。");
        return;
      }
      difficulty = parsed;
    }

    let favoriteScore: number | null = null;
    if (favoriteText.trim() !== "") {
      const parsed = Number(favoriteText);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 5) {
        setError("好みスコアは0〜5の整数で入力してください。");
        return;
      }
      favoriteScore = parsed;
    }

    let healthyScore: number | null = null;
    if (healthyText.trim() !== "") {
      const parsed = Number(healthyText);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 5) {
        setError("ヘルシースコアは0〜5の整数で入力してください。");
        return;
      }
      healthyScore = parsed;
    }

    for (const item of ingredients) {
      if (item.name.trim() === "") {
        continue;
      }
      if (item.quantityText.trim() !== "" && parseQuantityText(item.quantityText) === null) {
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
      proteinType: proteinType === "" ? null : proteinType,
      season: season === "" ? null : season,
      difficulty,
      favoriteScore,
      healthyScore,
      ingredients: ingredientInputs,
      steps: steps.map((step) => ({ text: step.text })),
      memo,
      cookingProfile: {
        ...cookingProfile,
        activeCookingMinutes: cookingProfile.activeCookingMinutes ?? cookingTimeMinutes,
        totalCookingMinutes: cookingProfile.totalCookingMinutes ?? cookingTimeMinutes,
        stepCount: cookingProfile.stepCount ?? steps.length,
        source: "manual",
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

      <fieldset className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <legend className="px-1 text-sm font-medium text-on-surface">
          栄養・特性（任意）
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["カロリー", caloriesText, setCaloriesText, "kcal"],
              ["たんぱく質", proteinText, setProteinText, "g"],
              ["脂質", fatText, setFatText, "g"],
              ["炭水化物", carbsText, setCarbsText, "g"],
              ["塩分", saltText, setSaltText, "g"],
              ["野菜量", vegetablesText, setVegetablesText, "g"],
            ] as const
          ).map(([label, value, setter, unit]) => (
            <label key={label} className="block space-y-1">
              <span className="text-xs text-on-surface-variant">
                {label}（{unit}）
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(event) => setter(event.target.value)}
                className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                placeholder="未入力可"
              />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">たんぱく源</span>
            <select
              value={proteinType}
              onChange={(event) =>
                setProteinType(event.target.value as ProteinType | "")
              }
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
            >
              <option value="">未設定</option>
              {PROTEIN_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">季節</span>
            <select
              value={season}
              onChange={(event) =>
                setSeason(event.target.value as RecipeSeason | "")
              }
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
            >
              <option value="">未設定</option>
              {RECIPE_SEASONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">難易度 1〜5</span>
            <input
              type="number"
              min={1}
              max={5}
              value={difficultyText}
              onChange={(event) => setDifficultyText(event.target.value)}
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
              placeholder="未入力可"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">好み 0〜5</span>
            <input
              type="number"
              min={0}
              max={5}
              value={favoriteText}
              onChange={(event) => setFavoriteText(event.target.value)}
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
              placeholder="未入力可"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">ヘルシー 0〜5</span>
            <input
              type="number"
              min={0}
              max={5}
              value={healthyText}
              onChange={(event) => setHealthyText(event.target.value)}
              className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm"
              placeholder="未入力可"
            />
          </label>
        </div>
      </fieldset>

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
