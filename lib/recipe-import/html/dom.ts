import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

/** 関連・SNS・広告など、以降の手順抽出を打ち切る見出し */
export const RELATED_SECTION_HEADING =
  /^(関連記事|関連レシピ|おすすめ|人気|ランキング|新着|最新記事|前の記事|次の記事|他のレシピ|おすすめレシピ|人気レシピ|Instagram|Facebook|X|Twitter|LINE|Pinterest|広告|スポンサー|PR|コメント|タグ|レシピカテゴリー|新着レシピ|RSS)([：:\s　].*)?$/i;

export const INGREDIENT_HEADING =
  /材料|調味料|用意するもの|ingredients?/i;

export const STEP_HEADING =
  /作り方|つくり方|手順|調理手順|工程|下準備|仕上げ|instructions?/i;

export const GROUP_ONLY =
  /^(A|B|C|D|E|ソース|付け合わせ|タレ|下味|衣)$/i;

/** 人数表記のみの行（材料にしない） */
export const SERVINGS_ONLY_LINE =
  /^[☆★＊*\s　]*(\d+)\s*人[分前][☆★＊*\s　]*$/u;

export function isRelatedSectionHeading(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 40) return false;
  return RELATED_SECTION_HEADING.test(normalized);
}

export function isStepHeading(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return STEP_HEADING.test(normalized) && !isRelatedSectionHeading(normalized);
}

export function isIngredientHeading(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return INGREDIENT_HEADING.test(normalized) && !isRelatedSectionHeading(normalized);
}

/** 材料グループ見出し（材料として登録しない） */
export function isIngredientGroupHeading(text: string): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length > 50) return false;
  if (SERVINGS_ONLY_LINE.test(trimmed)) return false;
  if (GROUP_ONLY.test(trimmed) || /^[A-E]$/i.test(trimmed)) return true;

  const unwrapped = cleanGroupName(trimmed);
  if (GROUP_ONLY.test(unwrapped) || /^[A-E]$/i.test(unwrapped)) return true;

  // <BONIQする材料> や 【袋に入れる調味料】など
  if (/^[<＜【「『\[]/.test(trimmed) || /[>＞】」』\]]$/.test(trimmed)) {
    return /材料|調味料|用意|ソース|タレ|付け合わせ|下味|衣|A|B|C/.test(unwrapped);
  }

  // 「BONIQする材料」「BONIQ後、袋に入れる調味料」など具体グループ
  if (
    /材料|調味料|用意するもの/.test(unwrapped) &&
    unwrapped !== "材料" &&
    unwrapped !== "材料一覧" &&
    unwrapped.length >= 3
  ) {
    return true;
  }

  return false;
}

export function cleanGroupName(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[<＜【「『\[\s☆★]+/, "")
    .replace(/[>＞】」』\]\s☆★]+$/, "")
    .trim();
}

export function parseServingsLine(
  text: string,
): { servings: number; text: string } | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const only = trimmed.match(SERVINGS_ONLY_LINE);
  if (only) {
    return { servings: Number(only[1]), text: `${only[1]}人分` };
  }
  const match = trimmed.match(/(\d+)\s*[〜~\-－]?\s*(\d+)?\s*人[分前]/);
  if (!match) return null;
  return { servings: Number(match[1]), text: match[0] };
}

/** script/style/nav/footer/広告などを除去した本文向け DOM */
export function loadCleanDom(html: string): cheerio.CheerioAPI {
  const $ = cheerio.load(html);
  $(
    "script, style, noscript, iframe, svg, canvas, template, link[rel='stylesheet']",
  ).remove();
  $("nav, footer, header, aside").remove();
  $(
    "[hidden], .ad, .ads, .advertisement, .share, .sns, .social, .breadcrumb, .related, .recommend, .cookie, .banner",
  ).remove();
  $("*").each((_, el) => {
    const node = el as Element;
    const style = node.attribs?.style ?? "";
    if (/display\s*:\s*none/i.test(style) || /visibility\s*:\s*hidden/i.test(style)) {
      $(node).remove();
    }
  });

  // 関連・おすすめ・広告ブロックを見出しごと除外
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const title = $(el).text().replace(/\s+/g, " ").trim();
    if (!isRelatedSectionHeading(title)) return;
    const removeList: AnyNode[] = [el];
    let next = $(el).next();
    while (next.length > 0) {
      const tag = (next.prop("tagName") ?? "").toLowerCase();
      if (/^h[1-6]$/.test(tag)) break;
      const node = next.get(0);
      if (node) removeList.push(node);
      next = next.next();
    }
    for (const node of removeList) {
      $(node).remove();
    }
  });

  return $;
}

export function textContent($: cheerio.CheerioAPI, el: AnyNode | null): string {
  if (!el) return "";
  const clone = $(el).clone();
  clone.find("img, picture, svg, video").remove();
  return clone.text().replace(/\s+/g, " ").trim();
}

export function getMeta(
  $: cheerio.CheerioAPI,
  selector: string,
  attr = "content",
): string | null {
  const value = $(selector).attr(attr)?.trim();
  return value || null;
}

export function extractOpenGraph($: cheerio.CheerioAPI): {
  title: string | null;
  description: string | null;
  image: string | null;
  author: string | null;
  canonical: string | null;
} {
  return {
    title:
      getMeta($, 'meta[property="og:title"]') ||
      getMeta($, 'meta[name="twitter:title"]'),
    description:
      getMeta($, 'meta[property="og:description"]') ||
      getMeta($, 'meta[name="description"]'),
    image: getMeta($, 'meta[property="og:image"]'),
    author:
      getMeta($, 'meta[property="article:author"]') ||
      getMeta($, 'meta[name="author"]'),
    canonical: getMeta($, 'link[rel="canonical"]', "href"),
  };
}

/** AI送信用に短縮した本文テキスト */
export function extractMainTextForAi(html: string, maxChars = 12000): string {
  const $ = loadCleanDom(html);
  const preferred =
    $("article").first().text() ||
    $("main").first().text() ||
    $("body").text();
  return preferred.replace(/\s+/g, " ").trim().slice(0, maxChars);
}
