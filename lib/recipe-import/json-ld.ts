import { parseIso8601DurationToMinutes } from "@/lib/recipe-import/duration";
import { parseIngredientLine } from "@/lib/recipe-import/parse-ingredient";
import { findLdJsonScriptContents } from "@/lib/recipe-import/url-import-debug";
import type {
  ImportCuisine,
  ImportMealRole,
  ImportStapleType,
  ImportMealStyle,
  RecipeDraft,
  RecipeDraftIngredient,
  RecipeDraftStep,
} from "@/types/recipe-import";

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj["@value"] === "string") return obj["@value"].trim();
    if (typeof obj.name === "string") return obj.name.trim();
    if (typeof obj.text === "string") return obj.text.trim();
  }
  return "";
}

function hasRecipeType(typeValue: unknown): boolean {
  return asArray(typeValue).some((item) => {
    const text = String(item);
    return (
      text === "Recipe" ||
      text.endsWith("/Recipe") ||
      text.toLowerCase() === "recipe"
    );
  });
}

function extractImage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractImage(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url;
  }
  return null;
}

function parseYield(value: unknown): { servings: number | null; text: string | null } {
  const text = textOf(value);
  if (!text) return { servings: null, text: null };
  const match = text.match(/(\d+)/);
  return {
    servings: match ? Number(match[1]) : null,
    text,
  };
}

function parseInstructions(value: unknown): RecipeDraftStep[] {
  const steps: RecipeDraftStep[] = [];
  let order = 1;

  function pushText(text: string): void {
    const cleaned = text.trim();
    if (!cleaned) return;
    steps.push({ order: order++, text: cleaned, confidence: "medium" });
  }

  function walk(node: unknown): void {
    if (node == null) return;
    if (typeof node === "string") {
      node
        .split(/\n+/)
        .map((line) => line.replace(/^\d+[\.\s]*/, "").trim())
        .filter(Boolean)
        .forEach(pushText);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const types = asArray(obj["@type"]).map(String);
      if (types.some((t) => t.includes("HowToSection"))) {
        walk(obj.itemListElement ?? obj.steps);
        return;
      }
      if (types.some((t) => t.includes("HowToStep"))) {
        pushText(textOf(obj.text) || textOf(obj.name));
        return;
      }
      if (obj.text || obj.name) {
        pushText(textOf(obj.text) || textOf(obj.name));
      }
      if (obj.itemListElement) walk(obj.itemListElement);
    }
  }

  walk(value);
  return steps;
}

function parseIngredients(value: unknown): RecipeDraftIngredient[] {
  return asArray(value)
    .map((item) => textOf(item))
    .filter(Boolean)
    .map((raw) => {
      const parsed = parseIngredientLine(raw);
      return {
        rawText: raw,
        name: parsed.name,
        quantity: parsed.quantity,
        quantityText: parsed.quantityText,
        unit: parsed.unit,
        note: parsed.note,
        alias: parsed.alias,
        confidence: parsed.quantity == null && !parsed.quantityText ? "low" : "medium",
      };
    });
}

function guessCuisine(category: string, name: string): ImportCuisine {
  const blob = `${category} ${name}`;
  if (/イタリアン|パスタ|カルボナーラ|ペペロン/.test(blob)) return "italian";
  if (/中華|麻婆|餃子/.test(blob)) return "chinese";
  if (/韓国|キムチ/.test(blob)) return "korean";
  if (/和食|味噌|照り焼|生姜/.test(blob)) return "japanese";
  if (/洋食|ハンバーグ|グラタン/.test(blob)) return "western";
  return "unknown";
}

function guessRoleAndStaple(
  name: string,
  category: string,
): { mealRole: ImportMealRole; stapleType: ImportStapleType; mealStyle: ImportMealStyle } {
  const blob = `${name} ${category}`;
  if (/パスタ|スパゲティ|カルボナーラ|ペペロン/.test(blob)) {
    return { mealRole: "one_dish", stapleType: "pasta", mealStyle: "pasta_set" };
  }
  if (/うどん|そば|ラーメン|麺/.test(blob)) {
    return { mealRole: "one_dish", stapleType: "noodles", mealStyle: "noodle_set" };
  }
  if (/丼/.test(blob)) {
    return { mealRole: "one_dish", stapleType: "rice", mealStyle: "rice_bowl_set" };
  }
  if (/カレー/.test(blob)) {
    return { mealRole: "one_dish", stapleType: "rice", mealStyle: "curry_set" };
  }
  if (/スープ|汁|味噌汁/.test(blob)) {
    return { mealRole: "soup", stapleType: "none", mealStyle: "japanese_set" };
  }
  if (/サラダ/.test(blob)) {
    return { mealRole: "salad", stapleType: "none", mealStyle: "standalone" };
  }
  if (/照り焼|生姜焼|焼き魚|ハンバーグ|唐揚/.test(blob)) {
    return { mealRole: "main", stapleType: "none", mealStyle: "japanese_set" };
  }
  return { mealRole: "main", stapleType: "unknown", mealStyle: "unknown" };
}

function collectGraph(data: unknown, out: Record<string, unknown>[]): void {
  if (data == null) return;
  if (Array.isArray(data)) {
    data.forEach((item) => collectGraph(item, out));
    return;
  }
  if (typeof data !== "object") return;
  const obj = data as Record<string, unknown>;
  out.push(obj);
  if (obj["@graph"]) collectGraph(obj["@graph"], out);
}

/** HTML 内の JSON-LD から Recipe を抽出 */
export function extractRecipesFromJsonLdHtml(html: string): Record<string, unknown>[] {
  const recipes: Record<string, unknown>[] = [];
  const rawScripts = findLdJsonScriptContents(html);
  for (const raw of rawScripts) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const nodes: Record<string, unknown>[] = [];
      collectGraph(parsed, nodes);
      for (const node of nodes) {
        if (hasRecipeType(node["@type"])) {
          recipes.push(node);
        }
      }
    } catch {
      // 壊れた JSON-LD は無視
    }
  }
  return recipes;
}

export function jsonLdRecipeToDraft(
  node: Record<string, unknown>,
  sourceUrl: string,
): RecipeDraft {
  const name = textOf(node.name) || "無題のレシピ";
  const description = textOf(node.description) || undefined;
  const yieldInfo = parseYield(node.recipeYield);
  const category = textOf(node.recipeCategory) || textOf(node.recipeCuisine) || null;
  const cuisine = guessCuisine(category ?? "", name);
  const roles = guessRoleAndStaple(name, category ?? "");
  const keywords = textOf(node.keywords);
  const tags = keywords
    ? keywords.split(/[,、]/).map((t) => t.trim()).filter(Boolean)
    : [];

  const author = (() => {
    const a = node.author;
    if (typeof a === "string") return a;
    if (a && typeof a === "object") return textOf((a as { name?: unknown }).name);
    return null;
  })();

  const cook = parseIso8601DurationToMinutes(node.cookTime);
  const prep = parseIso8601DurationToMinutes(node.prepTime);
  const total =
    parseIso8601DurationToMinutes(node.totalTime) ??
    (cook != null || prep != null ? (cook ?? 0) + (prep ?? 0) : null);

  const warnings: string[] = [];
  const ingredients = parseIngredients(node.recipeIngredient);
  const steps = parseInstructions(node.recipeInstructions);
  if (ingredients.length === 0) warnings.push("材料を読み取れませんでした");
  if (steps.length === 0) warnings.push("作り方を読み取れませんでした");
  if (total == null) warnings.push("調理時間が見つかりませんでした");

  return {
    title: name,
    description,
    servings: yieldInfo.servings,
    servingsText: yieldInfo.text,
    prepTimeMinutes: prep,
    cookTimeMinutes: cook,
    totalTimeMinutes: total,
    ingredients,
    steps,
    cuisine,
    category,
    mealRole: roles.mealRole,
    stapleType: roles.stapleType,
    mealStyle: roles.mealStyle,
    flavorTraits: [],
    tags,
    imageUrl: extractImage(node.image),
    sourceTitle: textOf(node.name) || null,
    sourceUrl,
    sourceAuthor: author,
    importMethod: "url",
    importedAt: new Date().toISOString(),
    warnings,
    confidence: warnings.length === 0 ? "high" : "medium",
  };
}

export function htmlToRecipeDraft(html: string, sourceUrl: string): {
  draft: RecipeDraft | null;
  warnings: string[];
} {
  const nodes = extractRecipesFromJsonLdHtml(html);
  if (nodes.length === 0) {
    return {
      draft: null,
      warnings: ["レシピの構造化データが見つかりませんでした"],
    };
  }
  const draft = jsonLdRecipeToDraft(nodes[0], sourceUrl);
  return { draft, warnings: draft.warnings ?? [] };
}
