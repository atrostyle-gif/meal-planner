/**
 * 1食を「セット」として評価する。
 * 個別料理の良さだけでなく、ジャンル・主食・味付け・調理法・役割の相性を見る。
 */
import {
  isCurryOrStew,
  isDonburiDish,
  isFriedDish,
  isNoodleDish,
} from "@/lib/recipe-nutrition";
import type { Recipe } from "@/types/recipe";
import type { RecipeCategory } from "@/types/recipe";
import type { RecipeCourse } from "@/types/course";

export type CuisineFamily =
  | "japanese"
  | "western"
  | "italian"
  | "chinese"
  | "korean"
  | "curry"
  | "neutral";

export type FlavorProfile =
  | "soy_savory"
  | "teriyaki_sweet"
  | "ginger"
  | "miso"
  | "spicy"
  | "tomato"
  | "cream"
  | "garlic_oil"
  | "salt_pepper"
  | "neutral";

export type CookingMethodFamily =
  | "fried"
  | "grilled"
  | "simmered"
  | "stir_fried"
  | "raw"
  | "baked"
  | "steamed"
  | "boiled"
  | "neutral";

export type StapleRole =
  | "rice"
  | "pasta"
  | "noodle"
  | "bread"
  | "donburi"
  | "curry_rice"
  | "none";

export type MealSetProfile = {
  cuisine: CuisineFamily;
  flavors: FlavorProfile[];
  method: CookingMethodFamily;
  staple: StapleRole;
  isCenterpiece: boolean;
};

export type MealSetEvaluation = {
  points: number;
  reasons: string[];
  warnings: string[];
  /** 組み合わせとして明らかに不自然 */
  incompatible: boolean;
};

function blobOf(recipe: Pick<Recipe, "name" | "tags" | "category" | "memo">): string {
  return `${recipe.name} ${recipe.tags.join(" ")} ${recipe.category} ${recipe.memo ?? ""}`;
}

export function detectCuisineFamily(
  recipe: Pick<Recipe, "name" | "tags" | "category" | "mealAffinity">,
): CuisineFamily {
  const importedCuisine = recipe.mealAffinity?.cuisine;
  if (
    importedCuisine === "japanese" ||
    importedCuisine === "western" ||
    importedCuisine === "italian" ||
    importedCuisine === "chinese" ||
    importedCuisine === "korean"
  ) {
    return importedCuisine;
  }
  const category = recipe.category as RecipeCategory;
  const blob = `${recipe.name} ${recipe.tags.join(" ")}`;

  if (category === "イタリアン" || /パスタ|カルボナーラ|ペペロン|ボロネーゼ|アラビアータ|ジェノベーゼ|リゾット|ピザ/.test(blob)) {
    return "italian";
  }
  if (category === "中華" || /麻婆|餃子|酢豚|チャーハン|中華|回鍋|青椒/.test(blob)) {
    return "chinese";
  }
  if (category === "韓国" || /キムチ|ビビンバ|チゲ|プルコギ|サムギョプ/.test(blob)) {
    return "korean";
  }
  if (category === "カレー" || isCurryOrStew(recipe)) {
    return "curry";
  }
  if (
    category === "洋食" ||
    /ハンバーグ|グラタン|シチュー|オムライス|ステーキ|フライド|コロッケ/.test(blob)
  ) {
    return "western";
  }
  if (
    category === "和食" ||
    category === "丼物" ||
    category === "鍋" ||
    /照り焼き|生姜焼き|煮|焼き魚|刺身|味噌汁|和え|煮物|天ぷら|うどん|そば|定食/.test(blob)
  ) {
    return "japanese";
  }
  if (category === "麺類" && /ラーメン|焼きそば/.test(blob)) {
    return /ラーメン/.test(blob) ? "chinese" : "japanese";
  }
  if (category === "麺類" && /パスタ|スパゲティ/.test(blob)) {
    return "italian";
  }
  return "neutral";
}

export function detectFlavorProfiles(
  recipe: Pick<Recipe, "name" | "tags" | "category" | "memo">,
): FlavorProfile[] {
  const blob = blobOf(recipe);
  const flavors: FlavorProfile[] = [];
  if (/照り焼|照りやき|テリヤキ/.test(blob)) flavors.push("teriyaki_sweet");
  if (/生姜焼|しょうが焼|ジンジャー/.test(blob)) flavors.push("ginger");
  if (/味噌|みそ/.test(blob)) flavors.push("miso");
  if (/辛|麻婆|キムチ|カレー|アラビアータ|ペペロン/.test(blob)) flavors.push("spicy");
  if (/トマト|ナポリタン|ボロネーゼ|アラビアータ|ミートソース/.test(blob)) flavors.push("tomato");
  if (/クリーム|カルボナーラ|グラタン|ホワイトソース|シチュー/.test(blob)) flavors.push("cream");
  if (/ペペロン|アーリオ|オイル|ニンニク|にんにく/.test(blob)) flavors.push("garlic_oil");
  if (/醤油|しょうゆ|蒲焼|煮付|煮つけ|めんつゆ|だし/.test(blob)) flavors.push("soy_savory");
  if (/塩胡椒|塩こしょう|ソルト|ペッパー/.test(blob)) flavors.push("salt_pepper");
  return flavors.length > 0 ? flavors : ["neutral"];
}

export function detectCookingMethod(
  recipe: Pick<Recipe, "name" | "tags" | "category">,
): CookingMethodFamily {
  if (isFriedDish(recipe)) return "fried";
  const blob = `${recipe.name} ${recipe.tags.join(" ")}`;
  if (/炒め|回鍋|青椒|麻婆/.test(blob)) return "stir_fried";
  if (/焼|ステーキ|ハンバーグ|グリル|蒲焼|照り焼|生姜焼/.test(blob)) return "grilled";
  if (/煮|煮込|カレー|シチュー|鍋/.test(blob)) return "simmered";
  if (/蒸|レンジ/.test(blob)) return "steamed";
  if (/オーブン|グラタン|ロースト|ベイク/.test(blob)) return "baked";
  if (/茹で|ゆで|うどん|そば|パスタ/.test(blob)) return "boiled";
  if (/刺身|たたき|サラダ/.test(blob)) return "raw";
  return "neutral";
}

export function detectStapleRole(
  recipe: Pick<Recipe, "name" | "tags" | "category" | "course">,
): StapleRole {
  if (isDonburiDish(recipe)) return "donburi";
  if (isCurryOrStew(recipe)) return "curry_rice";
  if (
    recipe.category === "イタリアン" ||
    /パスタ|スパゲティ|カルボナーラ|ペペロン|ボロネーゼ/.test(recipe.name)
  ) {
    return "pasta";
  }
  if (isNoodleDish(recipe)) return "noodle";
  if (/パン|トースト|サンド/.test(recipe.name)) return "bread";
  if (
    recipe.course === "主食" ||
    /ごはん|ご飯|白米|ライス|炊飯/.test(recipe.name)
  ) {
    return "rice";
  }
  return "none";
}

/** 食卓の主役になりやすい料理か（パスタ単品・丼・カレー・主菜の肉魚など） */
export function isCenterpieceDish(recipe: Recipe): boolean {
  const staple = detectStapleRole(recipe);
  if (
    staple === "pasta" ||
    staple === "noodle" ||
    staple === "donburi" ||
    staple === "curry_rice"
  ) {
    return true;
  }
  if (recipe.course === "主菜") return true;
  if (recipe.course === "主食" && staple !== "rice") return true;
  return false;
}

export function buildMealSetProfile(recipe: Recipe): MealSetProfile {
  return {
    cuisine: detectCuisineFamily(recipe),
    flavors: detectFlavorProfiles(recipe),
    method: detectCookingMethod(recipe),
    staple: detectStapleRole(recipe),
    isCenterpiece: isCenterpieceDish(recipe),
  };
}

function cuisineClash(a: CuisineFamily, b: CuisineFamily): boolean {
  if (a === "neutral" || b === "neutral" || a === b) return false;
  const westernish = new Set<CuisineFamily>(["italian", "western"]);
  const asian = new Set<CuisineFamily>(["japanese", "chinese", "korean"]);
  if (westernish.has(a) && asian.has(b)) return true;
  if (asian.has(a) && westernish.has(b)) return true;
  if ((a === "italian" && b === "curry") || (a === "curry" && b === "italian")) {
    return true;
  }
  if ((a === "korean" && b === "italian") || (a === "italian" && b === "korean")) {
    return true;
  }
  return false;
}

function flavorClash(a: FlavorProfile[], b: FlavorProfile[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  const pairs: Array<[FlavorProfile, FlavorProfile]> = [
    ["cream", "soy_savory"],
    ["cream", "teriyaki_sweet"],
    ["cream", "ginger"],
    ["cream", "miso"],
    ["tomato", "ginger"],
    ["tomato", "teriyaki_sweet"],
    ["tomato", "miso"],
    ["garlic_oil", "teriyaki_sweet"],
    ["garlic_oil", "ginger"],
    ["garlic_oil", "miso"],
    ["garlic_oil", "soy_savory"],
  ];
  for (const [left, right] of pairs) {
    if (
      (setA.has(left) && setB.has(right)) ||
      (setA.has(right) && setB.has(left))
    ) {
      return true;
    }
  }
  return false;
}

function describeCuisine(family: CuisineFamily): string {
  switch (family) {
    case "japanese":
      return "和食";
    case "italian":
      return "イタリアン";
    case "western":
      return "洋食";
    case "chinese":
      return "中華";
    case "korean":
      return "韓国料理";
    case "curry":
      return "カレー";
    default:
      return "料理";
  }
}

/**
 * すでに選んだ料理と候補の相性を評価する（選定時に使う）。
 */
export function evaluateCandidateAgainstMealSet(
  alreadyPicked: Recipe[],
  candidate: Recipe,
): MealSetEvaluation {
  if (alreadyPicked.length === 0) {
    return { points: 0, reasons: [], warnings: [], incompatible: false };
  }

  const candidateProfile = buildMealSetProfile(candidate);
  let points = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
  let incompatible = false;

  const centerpieces = alreadyPicked.filter((recipe) => isCenterpieceDish(recipe));
  const pickedProfiles = alreadyPicked.map(buildMealSetProfile);

  // 主役が重なる（パスタ＋生姜焼き、丼＋別主菜など）
  if (candidateProfile.isCenterpiece && centerpieces.length >= 1) {
    const other = centerpieces[0];
    const otherProfile = buildMealSetProfile(other);
    const pastaLike =
      candidateProfile.staple === "pasta" ||
      candidateProfile.staple === "noodle" ||
      otherProfile.staple === "pasta" ||
      otherProfile.staple === "noodle" ||
      otherProfile.staple === "donburi" ||
      otherProfile.staple === "curry_rice" ||
      candidateProfile.staple === "donburi" ||
      candidateProfile.staple === "curry_rice";

    if (pastaLike || cuisineClash(candidateProfile.cuisine, otherProfile.cuisine)) {
      points -= 45;
      incompatible = true;
      warnings.push(
        `${other.name}と${candidate.name}は、食卓の主役が重なる不自然な組み合わせです`,
      );
    } else if (
      other.course === "主菜" &&
      candidate.course === "主菜"
    ) {
      points -= 25;
      warnings.push("主菜が重なりやすい組み合わせです");
    }
  }

  for (const picked of alreadyPicked) {
    const pickedProfile = buildMealSetProfile(picked);

    if (cuisineClash(pickedProfile.cuisine, candidateProfile.cuisine)) {
      // 副菜・汁物は主菜ジャンルに寄せる想定。主食同士・主菜同士は厳しく
      const bothMains =
        (picked.course === "主食" || picked.course === "主菜") &&
        (candidate.course === "主食" || candidate.course === "主菜");
      if (bothMains) {
        points -= 50;
        incompatible = true;
        warnings.push(
          `${describeCuisine(pickedProfile.cuisine)}と${describeCuisine(candidateProfile.cuisine)}が混在する組み合わせを避けました`,
        );
      } else if (candidate.course === "副菜" || candidate.course === "汁物") {
        points -= 12;
        warnings.push(
          `主菜の雰囲気に合わせにくい${candidate.course}です`,
        );
      }
    }

    if (flavorClash(pickedProfile.flavors, candidateProfile.flavors)) {
      const bothMains =
        (picked.course === "主食" || picked.course === "主菜") &&
        (candidate.course === "主食" || candidate.course === "主菜");
      if (bothMains) {
        points -= 40;
        incompatible = true;
        warnings.push("味付けの系統が合わない組み合わせです");
      } else {
        points -= 10;
      }
    }

    // 揚げ物の重複はセット評価でも減点
    if (
      pickedProfile.method === "fried" &&
      candidateProfile.method === "fried"
    ) {
      points -= 18;
      warnings.push("揚げ物が重なる組み合わせです");
    }
  }

  // 定食スタイル加点: ご飯＋和食主菜＋副菜/汁物
  const all = [...alreadyPicked, candidate];
  const staples = all.map(detectStapleRole);
  const hasRice = staples.includes("rice");
  const hasJapaneseMain = all.some(
    (recipe) =>
      recipe.course === "主菜" && detectCuisineFamily(recipe) === "japanese",
  );
  const hasSide = all.some((recipe) => recipe.course === "副菜");
  const hasSoup = all.some((recipe) => recipe.course === "汁物");
  if (hasRice && hasJapaneseMain && (hasSide || hasSoup)) {
    points += 12;
    reasons.push("ご飯を中心にした定食らしい組み合わせです");
  }

  // パスタ中心のセット: 軽い副菜・スープなら加点
  const hasPasta = staples.includes("pasta");
  if (hasPasta) {
    const heavyExtraMain = all.some(
      (recipe) =>
        recipe.course === "主菜" &&
        detectCuisineFamily(recipe) === "japanese" &&
        isCenterpieceDish(recipe),
    );
    if (heavyExtraMain) {
      points -= 45;
      incompatible = true;
      warnings.push("パスタに重い主菜を重ねる組み合わせを避けました");
    } else if (
      candidate.course === "副菜" ||
      candidate.course === "汁物" ||
      candidate.category === "サラダ" ||
      candidate.category === "スープ"
    ) {
      points += 10;
      reasons.push("パスタに合うシンプルな付け合わせです");
    }
  }

  // ジャンル統一加点
  const mainCuisines = pickedProfiles
    .concat(candidateProfile)
    .filter((_, index) => {
      const recipe = index < alreadyPicked.length ? alreadyPicked[index] : candidate;
      return recipe.course === "主食" || recipe.course === "主菜";
    })
    .map((profile) => profile.cuisine)
    .filter((cuisine) => cuisine !== "neutral");
  if (mainCuisines.length >= 2 && mainCuisines.every((cuisine) => cuisine === mainCuisines[0])) {
    points += 8;
    reasons.push(`${describeCuisine(mainCuisines[0])}でまとまった献立です`);
  }

  return {
    points,
    reasons: [...new Set(reasons)].slice(0, 3),
    warnings: [...new Set(warnings)].slice(0, 3),
    incompatible,
  };
}

/**
 * 1日分の料理セット全体を評価する。
 */
export function evaluateMealSetCompatibility(recipes: Recipe[]): MealSetEvaluation {
  if (recipes.length <= 1) {
    return { points: 0, reasons: [], warnings: [], incompatible: false };
  }

  let points = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
  let incompatible = false;

  for (let index = 1; index < recipes.length; index += 1) {
    const partial = recipes.slice(0, index);
    const next = recipes[index];
    const result = evaluateCandidateAgainstMealSet(partial, next);
    points += result.points;
    reasons.push(...result.reasons);
    warnings.push(...result.warnings);
    if (result.incompatible) incompatible = true;
  }

  // 役割のバランス
  const courses = new Set(recipes.map((recipe) => recipe.course as RecipeCourse));
  if (courses.has("主菜") && courses.has("副菜")) {
    points += 6;
    reasons.push("主菜と副菜の役割が分かれた献立です");
  }
  if (courses.has("汁物")) {
    points += 4;
  }

  // 主食がご飯以外の完成系なのに主菜もいる
  const staples = recipes.map(detectStapleRole);
  const completeStaple = staples.some(
    (staple) =>
      staple === "pasta" ||
      staple === "donburi" ||
      staple === "curry_rice" ||
      staple === "noodle",
  );
  const extraMain = recipes.filter((recipe) => recipe.course === "主菜").length;
  if (completeStaple && extraMain >= 1) {
    const pastaOrNoodle = staples.some(
      (staple) => staple === "pasta" || staple === "noodle",
    );
    if (pastaOrNoodle) {
      points -= 35;
      incompatible = true;
      warnings.push("麺・パスタ中心の献立に、別の主菜を重ねないようにしました");
    }
  }

  return {
    points: Math.max(-80, Math.min(40, points)),
    reasons: [...new Set(reasons)].slice(0, 4),
    warnings: [...new Set(warnings)].slice(0, 4),
    incompatible,
  };
}
