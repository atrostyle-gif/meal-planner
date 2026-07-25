import type {
  FoodDatabaseProvider,
  FoodRecord,
  FoodSearchResult,
} from "@/types/food-database";
import { normalizeFoodName } from "@/lib/nutrition/food-normalizer";
import foodsJson from "@/data/nutrition/foods.json";

/**
 * JSON配列から食品DBを構築する。
 * 将来の八訂差し替えは別 Provider を実装すればよい。
 */
export class InMemoryFoodDatabase implements FoodDatabaseProvider {
  readonly sourceId: string;
  readonly sourceVersion: string;
  private readonly foods: FoodRecord[];
  private readonly byCode = new Map<string, FoodRecord>();
  private readonly byNormalizedName = new Map<string, FoodRecord>();

  constructor(
    foods: FoodRecord[],
    sourceId = "json-foods",
    sourceVersion = "v1",
  ) {
    this.sourceId = sourceId;
    this.sourceVersion = sourceVersion;
    this.foods = foods;
    for (const food of foods) {
      this.byCode.set(food.foodCode, food);
      this.byNormalizedName.set(normalizeFoodName(food.name), food);
      for (const alias of food.aliases) {
        this.byNormalizedName.set(normalizeFoodName(alias), food);
      }
    }
  }

  list(): FoodRecord[] {
    return this.foods;
  }

  findByCode(foodCode: string): FoodRecord | null {
    return this.byCode.get(foodCode) ?? null;
  }

  searchByName(name: string): FoodSearchResult {
    const normalized = normalizeFoodName(name);
    if (!normalized) {
      return { food: null, confidence: "none", matchedAlias: null };
    }

    const exact = this.byNormalizedName.get(normalized);
    if (exact) {
      const matchedAlias =
        normalizeFoodName(exact.name) === normalized
          ? null
          : exact.aliases.find((a) => normalizeFoodName(a) === normalized) ??
            null;
      return {
        food: exact,
        confidence: matchedAlias ? "alias" : "exact",
        matchedAlias,
      };
    }

    let best: { food: FoodRecord; score: number; alias: string | null } | null =
      null;
    for (const food of this.foods) {
      const candidates = [food.name, ...food.aliases];
      for (const candidate of candidates) {
        const candNorm = normalizeFoodName(candidate);
        if (!candNorm) continue;
        let score = 0;
        if (normalized.includes(candNorm) || candNorm.includes(normalized)) {
          score =
            Math.min(normalized.length, candNorm.length) /
            Math.max(normalized.length, candNorm.length);
        }
        if (score < 0.55) continue;
        if (!best || score > best.score) {
          best = {
            food,
            score,
            alias: candidate === food.name ? null : candidate,
          };
        }
      }
    }

    if (best) {
      return {
        food: best.food,
        confidence: "fuzzy",
        matchedAlias: best.alias,
      };
    }

    return { food: null, confidence: "none", matchedAlias: null };
  }
}

let cachedDefault: FoodDatabaseProvider | null = null;

export function createJsonFoodDatabase(
  foods: FoodRecord[],
  sourceId = "meal-planner-household-v1",
  sourceVersion = "v1",
): FoodDatabaseProvider {
  return new InMemoryFoodDatabase(foods, sourceId, sourceVersion);
}

export function loadDefaultFoodDatabaseSync(): FoodDatabaseProvider {
  if (cachedDefault) return cachedDefault;
  cachedDefault = createJsonFoodDatabase(foodsJson as FoodRecord[]);
  return cachedDefault;
}

export async function loadDefaultFoodDatabase(): Promise<FoodDatabaseProvider> {
  return loadDefaultFoodDatabaseSync();
}

export function resetFoodDatabaseCacheForTests(): void {
  cachedDefault = null;
}

/**
 * 八訂など外部DB差し替え用のスケルトン。
 */
export class PlaceholderMextFoodDatabase implements FoodDatabaseProvider {
  readonly sourceId = "mext-std-tables-8th";
  readonly sourceVersion = "placeholder";

  list(): FoodRecord[] {
    return [];
  }

  findByCode(): FoodRecord | null {
    return null;
  }

  searchByName(): FoodSearchResult {
    return { food: null, confidence: "none", matchedAlias: null };
  }
}
