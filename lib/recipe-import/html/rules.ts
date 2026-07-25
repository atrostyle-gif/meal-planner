import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { parseIngredientLine } from "@/lib/recipe-import/parse-ingredient";
import {
  GROUP_ONLY,
  SERVINGS_ONLY_LINE,
  cleanGroupName,
  isIngredientGroupHeading,
  isIngredientHeading,
  isRelatedSectionHeading,
  isStepHeading,
  parseServingsLine,
  textContent,
} from "@/lib/recipe-import/html/dom";
import type {
  RecipeDraft,
  RecipeDraftIngredient,
  RecipeDraftStep,
} from "@/types/recipe-import";

export type HtmlRuleExtraction = {
  draft: RecipeDraft;
  detectedSections: string[];
  ingredientCandidateCount: number;
  stepCandidateCount: number;
  excludedCount: number;
};

const GROUP_MARKER = "__GROUP__:";

function parseMinutes(text: string): number | null {
  const hourMin = text.match(/(\d+)\s*時間\s*(\d+)?\s*分?/);
  if (hourMin) {
    return Number(hourMin[1]) * 60 + Number(hourMin[2] ?? 0);
  }
  const min = text.match(/(?:調理時間|所要時間|加熱時間|準備時間)?[：:\s]*(\d+)\s*分/);
  if (min) return Number(min[1]);
  return null;
}

function isNoiseStep(text: string): boolean {
  const t = text.trim();
  return (
    t.length < 2 ||
    isRelatedSectionHeading(t) ||
    /^STEP\s*\d+$/i.test(t) ||
    /^手順\s*\d+$/i.test(t) ||
    /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]$/.test(t) ||
    /シェア|ツイート|フォロー|関連レシピ|おすすめ|広告|PR|Amazon|楽天|ログイン|会員登録|コピーしました|Instagram|Facebook|Pinterest/.test(
      t,
    )
  );
}

function stripStepNumber(text: string): string {
  return text
    .replace(/^(?:STEP\s*)?\d+[\.．:：)）\s-]*/i, "")
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]\s*/, "")
    .replace(/^（\d+）\s*/, "")
    .replace(/^手順\s*\d+[：:\s]*/i, "")
    .trim();
}

function isHeadingTag(tag: string): boolean {
  return ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag);
}

function pushTableRows($: CheerioAPI, table: Cheerio<AnyNode>, lines: string[]): void {
  table.find("tr").each((_, tr) => {
    if ($(tr).closest("thead").length > 0) return;
    const cells = $(tr)
      .children("th, td")
      .toArray()
      .map((cell) => textContent($, cell))
      .filter(Boolean);
    if (cells.length === 0) return;
    if (cells.every((cell) => /^(品目|材料名|分量|数量|単位|材料)$/.test(cell))) {
      return;
    }
    if (cells.length >= 2) {
      lines.push(`${cells[0]} ${cells[1]}`);
    } else {
      lines.push(cells[0]);
    }
  });
}

/** 見出し以降を次の主要見出しまで収集（材料用） */
function collectIngredientLinesAfterHeading(
  $: CheerioAPI,
  heading: Cheerio<AnyNode>,
): string[] {
  const lines: string[] = [];
  const siblings = heading.nextAll().toArray();
  for (const child of siblings) {
    const tag = ((child as Element).name ?? "").toLowerCase();
    if (isHeadingTag(tag) || tag === "strong" || tag === "dt" || tag === "th") {
      const t = textContent($, child);
      if (isRelatedSectionHeading(t) || isStepHeading(t)) break;
      if (isIngredientGroupHeading(t) || isIngredientHeading(t)) {
        lines.push(`${GROUP_MARKER}${cleanGroupName(t)}`);
        continue;
      }
    }

    const block = $(child);
    if (tag === "table") {
      pushTableRows($, block, lines);
      continue;
    }
    block.find("table").each((_, table) => {
      pushTableRows($, $(table), lines);
    });

    if (tag === "ul" || tag === "ol") {
      block.children("li").each((_, li) => {
        const t = textContent($, li);
        if (t) lines.push(t);
      });
      continue;
    }
    if (tag === "dl") {
      block.children("dt, dd").each((_, el) => {
        const t = textContent($, el);
        if (!t) return;
        if (isIngredientGroupHeading(t)) {
          lines.push(`${GROUP_MARKER}${cleanGroupName(t)}`);
        } else {
          lines.push(t);
        }
      });
      continue;
    }

    block.find("li, p, dd").each((_, el) => {
      const t = textContent($, el);
      if (!t) return;
      if (isIngredientGroupHeading(t) && t.length < 40) {
        lines.push(`${GROUP_MARKER}${cleanGroupName(t)}`);
        return;
      }
      lines.push(t);
    });

    if (tag === "div" || tag === "section") {
      // 直下テキストだけのグループ見出し
      const directText = block
        .clone()
        .children()
        .remove()
        .end()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      if (directText && isIngredientGroupHeading(directText)) {
        lines.push(`${GROUP_MARKER}${cleanGroupName(directText)}`);
      }
    } else if (!["table", "ul", "ol", "dl"].includes(tag)) {
      const self = textContent($, child);
      if (self && lines[lines.length - 1] !== self && self.length < 120) {
        if (isIngredientGroupHeading(self)) {
          lines.push(`${GROUP_MARKER}${cleanGroupName(self)}`);
        } else {
          lines.push(self);
        }
      }
    }
  }
  return lines;
}

/** 見出し以降の手順を収集。関連記事見出しで打ち切る */
function collectStepLinesAfterHeading(
  $: CheerioAPI,
  heading: Cheerio<AnyNode>,
): string[] {
  const lines: string[] = [];
  const siblings = heading.nextAll().toArray();
  for (const child of siblings) {
    const tag = ((child as Element).name ?? "").toLowerCase();
    if (isHeadingTag(tag)) {
      const t = textContent($, child);
      if (isRelatedSectionHeading(t)) break;
      if (isIngredientHeading(t) && !/^STEP/i.test(t)) break;
      if (isStepHeading(t) && !/^STEP\s*\d+/i.test(t)) break;
      // STEP1 / ① だけの見出しはスキップして説明文を待つ
      if (/^STEP\s*\d+$/i.test(t) || /^[①②③④⑤⑥⑦⑧⑨⑩]$/.test(t) || /^\d+$/.test(t)) {
        continue;
      }
    }
    if (tag === "img" || tag === "picture" || tag === "figure") continue;

    const block = $(child);
    const className = `${block.attr("class") ?? ""} ${block.attr("id") ?? ""}`;
    if (/share|sns|related|recommend|ranking|ad\b|banner/i.test(className)) {
      continue;
    }

    // step ブロック: 画像を無視し説明文だけ取る
    if (
      tag === "div" ||
      tag === "section" ||
      tag === "li" ||
      /\bstep\b|instruction|recipe-step/i.test(className)
    ) {
      const paragraphs = block
        .find("p")
        .toArray()
        .map((el) => textContent($, el))
        .filter((t) => t && !isNoiseStep(t) && !/^STEP\s*\d+$/i.test(t));
      if (paragraphs.length > 0) {
        lines.push(paragraphs.join(""));
        continue;
      }
    }

    if (tag === "ol" || tag === "ul") {
      block.children("li").each((_, li) => {
        const t = extractStepTextFromElement($, $(li));
        if (t) lines.push(t);
      });
      continue;
    }

    if (tag === "p" || tag === "div" || tag === "li") {
      const t = extractStepTextFromElement($, block);
      if (t) lines.push(t);
    }
  }
  return lines;
}

function extractStepTextFromElement(
  $: CheerioAPI,
  el: Cheerio<AnyNode>,
): string | null {
  const clone = el.clone();
  clone.find("img, picture, svg, video, button, a.share").remove();
  const text = clone.text().replace(/\s+/g, " ").trim();
  const cleaned = stripStepNumber(text);
  if (!cleaned || isNoiseStep(cleaned)) return null;
  return cleaned;
}

function headingElements($: CheerioAPI): Cheerio<AnyNode> {
  return $("h1, h2, h3, h4, strong, dt, th");
}

function toIngredients(lines: string[]): {
  ingredients: RecipeDraftIngredient[];
  excludedCount: number;
  servings: { servings: number; text: string } | null;
} {
  const ingredients: RecipeDraftIngredient[] = [];
  let groupName: string | null = null;
  let excludedCount = 0;
  let servings: { servings: number; text: string } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      excludedCount += 1;
      continue;
    }
    if (trimmed.startsWith(GROUP_MARKER)) {
      groupName = trimmed.slice(GROUP_MARKER.length).trim() || null;
      continue;
    }
    if (SERVINGS_ONLY_LINE.test(trimmed) || /^材料[（(].*人[分前][）)]$/.test(trimmed)) {
      const parsed = parseServingsLine(trimmed);
      if (parsed) servings = parsed;
      continue;
    }
    if (isIngredientGroupHeading(trimmed) || GROUP_ONLY.test(trimmed)) {
      groupName = cleanGroupName(trimmed);
      continue;
    }
    if (trimmed.length > 120) {
      excludedCount += 1;
      continue;
    }

    const withGroup = trimmed.match(/^([A-E])\s+(.+)$/);
    const raw = withGroup ? withGroup[2] : trimmed.replace(/^[・●○◆■▶️▶\-\s]+/, "");
    const currentGroup = withGroup ? withGroup[1] : groupName;
    const parsed = parseIngredientLine(raw);
    if (!parsed.name || isRelatedSectionHeading(parsed.name)) {
      excludedCount += 1;
      continue;
    }
    // 人数だけの誤検出を材料にしない
    if (SERVINGS_ONLY_LINE.test(parsed.name) || /^\d+人[分前]$/.test(parsed.name)) {
      const s = parseServingsLine(parsed.name);
      if (s) servings = s;
      continue;
    }

    ingredients.push({
      rawText: trimmed,
      name: parsed.name,
      quantity: parsed.quantity,
      quantityText: parsed.quantityText,
      unit: parsed.unit,
      note: parsed.note,
      alias: parsed.alias,
      groupName: currentGroup,
      confidence: "medium",
    });
  }
  return { ingredients, excludedCount, servings };
}

function toSteps(lines: string[]): {
  steps: RecipeDraftStep[];
  excludedCount: number;
} {
  const steps: RecipeDraftStep[] = [];
  let excludedCount = 0;
  let order = 1;
  for (const line of lines) {
    if (isRelatedSectionHeading(line)) break;
    const cleaned = stripStepNumber(line);
    if (!cleaned || isNoiseStep(cleaned)) {
      excludedCount += 1;
      continue;
    }
    // 重複する連続同一手順は除外
    if (steps[steps.length - 1]?.text === cleaned) {
      excludedCount += 1;
      continue;
    }
    steps.push({ order: order++, text: cleaned, confidence: "medium" });
  }
  return { steps, excludedCount };
}

function extractFallbackSteps($: CheerioAPI): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  const push = (text: string | null): void => {
    if (!text || seen.has(text)) return;
    if (isRelatedSectionHeading(text) || isNoiseStep(text)) return;
    seen.add(text);
    lines.push(text);
  };

  $(".recipe-step, .instruction, p.step, div.step, [class*='recipe-step']").each(
    (_, el) => {
      push(extractStepTextFromElement($, $(el)));
    },
  );

  $("ol").each((_, ol) => {
    // 関連記事内の ol は除外済みのはず
    $(ol)
      .children("li")
      .each((__, li) => {
        push(extractStepTextFromElement($, $(li)));
      });
  });

  // STEP1 → 画像 → 説明 の並び
  $("h2, h3, h4, div, p").each((_, el) => {
    const t = textContent($, el);
    if (!/^STEP\s*\d+$/i.test(t) && !/^手順\s*\d+$/i.test(t)) return;
    let next = $(el).next();
    for (let i = 0; i < 6 && next.length > 0; i += 1) {
      const tag = (next.prop("tagName") ?? "").toLowerCase();
      if (isHeadingTag(tag) && isRelatedSectionHeading(textContent($, next.get(0) ?? null))) {
        break;
      }
      if (tag === "img" || tag === "picture" || tag === "figure") {
        next = next.next();
        continue;
      }
      const desc = extractStepTextFromElement($, next);
      if (desc) {
        push(desc);
        break;
      }
      next = next.next();
    }
  });

  return lines;
}

/** schema.org Microdata からの抽出 */
export function extractMicrodata($: CheerioAPI, sourceUrl: string): RecipeDraft | null {
  const root = $('[itemtype*="schema.org/Recipe"], [itemtype*="schema.org/recipe"]').first();
  if (root.length === 0) return null;
  const title =
    root.find('[itemprop="name"]').first().text().trim() ||
    root.attr("content") ||
    null;
  const descriptionEl = root.find('[itemprop="description"]').first();
  const description =
    descriptionEl.attr("content")?.trim() ||
    descriptionEl.text().trim() ||
    null;
  const yieldText = root.find('[itemprop="recipeYield"]').first().text().trim();
  const servings = parseServingsLine(yieldText || root.text());
  const ingredients: RecipeDraftIngredient[] = [];
  root.find('[itemprop="recipeIngredient"]').each((_, el) => {
    const raw = textContent($, el);
    if (!raw) return;
    const parsed = parseIngredientLine(raw);
    ingredients.push({
      rawText: raw,
      name: parsed.name,
      quantity: parsed.quantity,
      quantityText: parsed.quantityText,
      unit: parsed.unit,
      note: parsed.note,
      alias: parsed.alias,
      confidence: "medium",
    });
  });
  const steps: RecipeDraftStep[] = [];
  root.find('[itemprop="recipeInstructions"]').each((_, el) => {
    const raw = textContent($, el);
    if (!raw || isNoiseStep(raw)) return;
    steps.push({
      order: steps.length + 1,
      text: stripStepNumber(raw),
      confidence: "medium",
    });
  });
  if (!title && ingredients.length === 0 && steps.length === 0) return null;
  return {
    title: title || undefined,
    description: description || undefined,
    servings: servings?.servings ?? null,
    servingsText: servings?.text ?? null,
    ingredients,
    steps,
    importMethod: "url",
    sourceUrl,
    importedAt: new Date().toISOString(),
    importSource: "microdata",
    confidence: "medium",
    warnings: [],
  };
}

/** 汎用 HTML ルール解析 */
export function extractByHtmlRules(
  $: CheerioAPI,
  sourceUrl: string,
  og: {
    title: string | null;
    description: string | null;
    image: string | null;
    author: string | null;
  },
): HtmlRuleExtraction {
  const detectedSections: string[] = [];
  let ingredientLines: string[] = [];
  let stepLines: string[] = [];
  let excludedCount = 0;
  let ingredientSectionStarted = false;
  let stepSectionStarted = false;

  headingElements($).each((_, el) => {
    const heading = $(el);
    const title = textContent($, el);
    if (isRelatedSectionHeading(title)) return;

    if (
      !ingredientSectionStarted &&
      (isIngredientHeading(title) || isIngredientGroupHeading(title))
    ) {
      ingredientSectionStarted = true;
      detectedSections.push(`材料:${cleanGroupName(title)}`);
      if (isIngredientGroupHeading(title) && cleanGroupName(title) !== "材料") {
        ingredientLines.push(`${GROUP_MARKER}${cleanGroupName(title)}`);
      }
      ingredientLines = ingredientLines.concat(
        collectIngredientLinesAfterHeading($, heading),
      );
    }
    if (!stepSectionStarted && isStepHeading(title) && !isIngredientHeading(title)) {
      stepSectionStarted = true;
      detectedSections.push(`手順:${title}`);
      stepLines = stepLines.concat(collectStepLinesAfterHeading($, heading));
    }
  });

  if (stepLines.length === 0) {
    stepLines = extractFallbackSteps($);
  }

  if (ingredientLines.length === 0) {
    $("table").each((_, table) => {
      pushTableRows($, $(table), ingredientLines);
    });
  }

  const {
    ingredients,
    excludedCount: exIng,
    servings: servingsFromIngredients,
  } = toIngredients(ingredientLines);
  const { steps, excludedCount: exStep } = toSteps(stepLines);
  excludedCount += exIng + exStep;

  const h1 =
    $("article h1").first().text().trim() ||
    $("main h1").first().text().trim() ||
    $("h1").first().text().trim() ||
    null;
  const bodyText = $("article, main, body").first().text();
  const servings =
    servingsFromIngredients ||
    parseServingsLine(bodyText) ||
    null;
  const minutes = parseMinutes(bodyText);

  const warnings: string[] = [];
  if (ingredients.length > 0 && steps.length === 0) {
    warnings.push("材料は読み取れましたが、作り方を確認できませんでした");
  }
  if (steps.length > 0 && ingredients.length === 0) {
    warnings.push("作り方は読み取れましたが、材料の確認が必要です");
  }
  warnings.push(
    "構造化レシピ情報が見つからなかったため、ページ本文から読み取りました",
  );

  const draft: RecipeDraft = {
    title: h1 || og.title || undefined,
    description: og.description || undefined,
    servings: servings?.servings ?? null,
    servingsText: servings?.text ?? null,
    totalTimeMinutes: minutes,
    cookTimeMinutes: minutes,
    ingredients,
    steps,
    imageUrl: og.image,
    sourceAuthor: og.author,
    sourceUrl,
    sourceTitle: h1 || og.title,
    importMethod: "url",
    importedAt: new Date().toISOString(),
    importSource: "html_rules",
    confidence: ingredients.length + steps.length >= 3 ? "medium" : "low",
    warnings,
  };

  return {
    draft,
    detectedSections,
    ingredientCandidateCount: ingredientLines.length,
    stepCandidateCount: stepLines.length,
    excludedCount,
  };
}
