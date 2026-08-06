/**
 * URL取り込み AI 出力の Zod スキーマと JSON Schema
 */
import { z } from "zod";

const confidenceSchema = z.enum(["high", "medium", "low"]);

export const aiRecipeExtractionSchema = z.object({
  documentType: z.enum([
    "recipe_page",
    "partial_recipe",
    "not_recipe",
    "unknown",
  ]),
  title: z.string().nullable(),
  description: z.string().nullable(),
  servings: z.number().nullable(),
  servingsText: z.string().nullable(),
  prepTimeMinutes: z.number().nullable(),
  cookTimeMinutes: z.number().nullable(),
  totalTimeMinutes: z.number().nullable(),
  ingredients: z.array(
    z.object({
      groupName: z.string().nullable(),
      rawText: z.string(),
      name: z.string(),
      alternativeNames: z.array(z.string()).default([]),
      quantity: z.number().nullable(),
      quantityText: z.string().nullable(),
      unit: z.string().nullable(),
      note: z.string().nullable(),
      confidence: confidenceSchema.default("medium"),
    }),
  ),
  steps: z.array(
    z.object({
      order: z.number(),
      sectionName: z.string().nullable().optional(),
      text: z.string(),
      temperatureCelsius: z.number().nullable().optional(),
      durationMinutes: z.number().nullable().optional(),
      confidence: confidenceSchema.default("medium"),
    }),
  ),
  cuisine: z
    .enum([
      "japanese",
      "western",
      "italian",
      "chinese",
      "korean",
      "ethnic",
      "mixed",
      "other",
      "unknown",
    ])
    .default("unknown"),
  mealRole: z
    .enum([
      "staple",
      "main",
      "side",
      "soup",
      "salad",
      "dessert",
      "one_dish",
      "unknown",
    ])
    .default("unknown"),
  stapleType: z
    .enum(["rice", "bread", "pasta", "noodles", "none", "unknown"])
    .default("unknown"),
  mealStyle: z
    .enum([
      "japanese_set",
      "western_set",
      "pasta_set",
      "noodle_set",
      "rice_bowl_set",
      "curry_set",
      "hot_pot",
      "one_plate",
      "standalone",
      "unknown",
    ])
    .default("unknown"),
  cookingMethods: z.array(z.string()).default([]),
  flavorProfiles: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  sourceTitle: z.string().nullable().optional(),
  sourceAuthor: z.string().nullable().optional(),
  sourceUrl: z.string(),
  warnings: z.array(z.string()).default([]),
});

export type AIRecipeExtractionResult = z.infer<typeof aiRecipeExtractionSchema>;

/** OpenAI Structured Outputs 用 JSON Schema */
export const aiRecipeExtractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "documentType",
    "title",
    "description",
    "servings",
    "servingsText",
    "prepTimeMinutes",
    "cookTimeMinutes",
    "totalTimeMinutes",
    "ingredients",
    "steps",
    "cuisine",
    "mealRole",
    "stapleType",
    "mealStyle",
    "cookingMethods",
    "flavorProfiles",
    "tags",
    "sourceTitle",
    "sourceAuthor",
    "sourceUrl",
    "warnings",
  ],
  properties: {
    documentType: {
      type: "string",
      enum: ["recipe_page", "partial_recipe", "not_recipe", "unknown"],
    },
    title: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    servings: { type: ["number", "null"] },
    servingsText: { type: ["string", "null"] },
    prepTimeMinutes: { type: ["number", "null"] },
    cookTimeMinutes: { type: ["number", "null"] },
    totalTimeMinutes: { type: ["number", "null"] },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "groupName",
          "rawText",
          "name",
          "alternativeNames",
          "quantity",
          "quantityText",
          "unit",
          "note",
          "confidence",
        ],
        properties: {
          groupName: { type: ["string", "null"] },
          rawText: { type: "string" },
          name: { type: "string" },
          alternativeNames: { type: "array", items: { type: "string" } },
          quantity: { type: ["number", "null"] },
          quantityText: { type: ["string", "null"] },
          unit: { type: ["string", "null"] },
          note: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "order",
          "sectionName",
          "text",
          "temperatureCelsius",
          "durationMinutes",
          "confidence",
        ],
        properties: {
          order: { type: "number" },
          sectionName: { type: ["string", "null"] },
          text: { type: "string" },
          temperatureCelsius: { type: ["number", "null"] },
          durationMinutes: { type: ["number", "null"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    cuisine: {
      type: "string",
      enum: [
        "japanese",
        "western",
        "italian",
        "chinese",
        "korean",
        "ethnic",
        "mixed",
        "other",
        "unknown",
      ],
    },
    mealRole: {
      type: "string",
      enum: [
        "staple",
        "main",
        "side",
        "soup",
        "salad",
        "dessert",
        "one_dish",
        "unknown",
      ],
    },
    stapleType: {
      type: "string",
      enum: ["rice", "bread", "pasta", "noodles", "none", "unknown"],
    },
    mealStyle: {
      type: "string",
      enum: [
        "japanese_set",
        "western_set",
        "pasta_set",
        "noodle_set",
        "rice_bowl_set",
        "curry_set",
        "hot_pot",
        "one_plate",
        "standalone",
        "unknown",
      ],
    },
    cookingMethods: { type: "array", items: { type: "string" } },
    flavorProfiles: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    sourceTitle: { type: ["string", "null"] },
    sourceAuthor: { type: ["string", "null"] },
    sourceUrl: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

/**
 * YouTube取込専用: 材料・基本情報のみ（工程は含めない）
 */
export const aiYoutubeIngredientsSchema = z.object({
  documentType: z.enum([
    "recipe_page",
    "partial_recipe",
    "not_recipe",
    "unknown",
  ]),
  title: z.string().nullable(),
  servings: z.number().nullable(),
  servingsText: z.string().nullable(),
  ingredients: z.array(
    z.object({
      groupName: z.string().nullable(),
      rawText: z.string(),
      name: z.string(),
      alternativeNames: z.array(z.string()).default([]),
      quantity: z.number().nullable(),
      quantityText: z.string().nullable(),
      unit: z.string().nullable(),
      note: z.string().nullable(),
      confidence: confidenceSchema.default("medium"),
    }),
  ),
  cuisine: z
    .enum([
      "japanese",
      "western",
      "italian",
      "chinese",
      "korean",
      "ethnic",
      "mixed",
      "other",
      "unknown",
    ])
    .default("unknown"),
  mealRole: z
    .enum([
      "staple",
      "main",
      "side",
      "soup",
      "salad",
      "dessert",
      "one_dish",
      "unknown",
    ])
    .default("unknown"),
  sourceTitle: z.string().nullable().optional(),
  sourceAuthor: z.string().nullable().optional(),
  sourceUrl: z.string(),
  warnings: z.array(z.string()).default([]),
});

export type AIYoutubeIngredientsResult = z.infer<
  typeof aiYoutubeIngredientsSchema
>;

export const aiYoutubeIngredientsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "documentType",
    "title",
    "servings",
    "servingsText",
    "ingredients",
    "cuisine",
    "mealRole",
    "sourceTitle",
    "sourceAuthor",
    "sourceUrl",
    "warnings",
  ],
  properties: {
    documentType: {
      type: "string",
      enum: ["recipe_page", "partial_recipe", "not_recipe", "unknown"],
    },
    title: { type: ["string", "null"] },
    servings: { type: ["number", "null"] },
    servingsText: { type: ["string", "null"] },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "groupName",
          "rawText",
          "name",
          "alternativeNames",
          "quantity",
          "quantityText",
          "unit",
          "note",
          "confidence",
        ],
        properties: {
          groupName: { type: ["string", "null"] },
          rawText: { type: "string" },
          name: { type: "string" },
          alternativeNames: { type: "array", items: { type: "string" } },
          quantity: { type: ["number", "null"] },
          quantityText: { type: ["string", "null"] },
          unit: { type: ["string", "null"] },
          note: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    cuisine: {
      type: "string",
      enum: [
        "japanese",
        "western",
        "italian",
        "chinese",
        "korean",
        "ethnic",
        "mixed",
        "other",
        "unknown",
      ],
    },
    mealRole: {
      type: "string",
      enum: [
        "staple",
        "main",
        "side",
        "soup",
        "salad",
        "dessert",
        "one_dish",
        "unknown",
      ],
    },
    sourceTitle: { type: ["string", "null"] },
    sourceAuthor: { type: ["string", "null"] },
    sourceUrl: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

/** YouTube材料抽出結果を既存のURL抽出スキーマ形へ変換（stepsは常に空） */
export function youtubeIngredientsToExtractionResult(
  data: AIYoutubeIngredientsResult,
): AIRecipeExtractionResult {
  return {
    documentType: data.documentType,
    title: data.title,
    description: null,
    servings: data.servings,
    servingsText: data.servingsText,
    prepTimeMinutes: null,
    cookTimeMinutes: null,
    totalTimeMinutes: null,
    ingredients: data.ingredients,
    steps: [],
    cuisine: data.cuisine,
    mealRole: data.mealRole,
    stapleType: "unknown",
    mealStyle: "unknown",
    cookingMethods: [],
    flavorProfiles: [],
    tags: [],
    sourceTitle: data.sourceTitle,
    sourceAuthor: data.sourceAuthor,
    sourceUrl: data.sourceUrl,
    warnings: data.warnings,
  };
}

export function getRecipeImportModel(): string {
  return process.env.OPENAI_RECIPE_IMPORT_MODEL?.trim() || "gpt-4o-mini";
}
