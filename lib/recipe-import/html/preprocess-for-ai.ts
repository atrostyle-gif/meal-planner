/**
 * AI送信用のHTML前処理：ノイズ除去 + 構造を保った簡略マークダウン
 */
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { Cheerio, CheerioAPI } from "cheerio";
import {
  isIngredientHeading,
  isRelatedSectionHeading,
  isStepHeading,
  textContent,
} from "@/lib/recipe-import/html/dom";

export type AiPreparedPage = {
  structuredText: string;
  pageTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  siteName: string | null;
  detectedHeadings: string[];
  candidateSections: string[];
  charCount: number;
  truncated: boolean;
  /** 開発診断用 */
  preprocessDebug?: PreprocessDebugInfo;
};

export type PreprocessDebugInfo = {
  selectedRoot: string;
  selectedRootSelector: string;
  charsBeforeExtract: number;
  charsAfterExtract: number;
  removedTagCount: number;
  remainingHtmlHead1000: string;
  candidateProbe: Array<{
    selector: string;
    count: number;
    bestChars: number;
    hasIngredients: boolean;
    hasSteps: boolean;
  }>;
};

const MAX_CHARS = 14000;

const RECIPE_ROOT_CANDIDATES = [
  "main",
  '[role="main"]',
  ".single-recipe",
  ".recipe-template-default",
  "article.recipe",
  ".recipe-detail",
  ".entry-content",
  ".single",
  "#body.single",
  "#body",
  "article",
  "body",
] as const;

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function removeNoise($: CheerioAPI): number {
  let removed = 0;
  const trackRemove = (selector: string): void => {
    const nodes = $(selector);
    removed += nodes.length;
    nodes.remove();
  };

  trackRemove(
    "script, style, noscript, iframe, svg, canvas, template, form, button, input, textarea, select, link[rel='stylesheet']",
  );
  trackRemove("header, footer, nav, aside");
  trackRemove(
    "[hidden], .ad, .ads, .advertisement, .share, .sns, .social, .breadcrumb, .related, .recommend, .ranking, .cookie, .banner, .newsletter, .comment, .comments, .sidebar",
  );

  $("*").each((_, el) => {
    const node = el as Element;
    const style = node.attribs?.style ?? "";
    if (/display\s*:\s*none/i.test(style) || /visibility\s*:\s*hidden/i.test(style)) {
      $(node).remove();
      removed += 1;
    }
  });

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
    removed += removeList.length;
    for (const node of removeList) $(node).remove();
  });

  return removed;
}

function getMeta(
  $: CheerioAPI,
  selector: string,
  attr = "content",
): string | null {
  return $(selector).attr(attr)?.trim() || null;
}

function tableToMarkdown($: CheerioAPI, table: Cheerio<AnyNode>): string {
  const rows: string[] = [];
  table.find("tr").each((_, tr) => {
    if ($(tr).closest("thead").length > 0) return;
    const cells = $(tr)
      .children("th, td")
      .toArray()
      .map((cell) => textContent($, cell))
      .filter(Boolean);
    if (cells.length) rows.push(`- ${cells.join(" | ")}`);
  });
  return rows.join("\n");
}

function serializeNode(
  $: CheerioAPI,
  el: AnyNode,
  lines: string[],
  headings: string[],
  sections: string[],
): void {
  const tag = ((el as Element).name ?? "").toLowerCase();
  if (!tag || ["script", "style", "img", "picture", "video", "br", "hr"].includes(tag)) {
    return;
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    const text = textContent($, el);
    if (!text || isRelatedSectionHeading(text)) return;
    headings.push(text);
    if (isIngredientHeading(text)) sections.push(`材料:${text}`);
    if (isStepHeading(text)) sections.push(`手順:${text}`);
    lines.push(`${"#".repeat(Math.min(level, 4))} ${text}`);
    return;
  }

  if (tag === "table") {
    const md = tableToMarkdown($, $(el));
    if (md) lines.push(md);
    return;
  }

  if (tag === "ul" || tag === "ol") {
    $(el)
      .children("li")
      .each((_, li) => {
        const t = textContent($, li);
        if (t) lines.push(`- ${t}`);
      });
    return;
  }

  if (tag === "p" || tag === "figcaption" || tag === "li") {
    const t = textContent($, el);
    if (t) lines.push(t);
    return;
  }

  if (tag === "div" || tag === "section" || tag === "article" || tag === "main") {
    const className = `${$(el).attr("class") ?? ""} ${$(el).attr("id") ?? ""}`;
    // 関連カード等だけ除外。本文コンテナは落とさない
    if (
      /(^|\s)(share|sns|related|recommend|ranking|advertisement|cookie|comment|comments|sidebar)(\s|$)/i.test(
        className,
      )
    ) {
      return;
    }
    $(el)
      .children()
      .each((_, child) => serializeNode($, child, lines, headings, sections));
    return;
  }

  $(el)
    .children()
    .each((_, child) => serializeNode($, child, lines, headings, sections));
}

function prioritizeAndTruncate(text: string, maxChars: number): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= maxChars) return { text, truncated: false };

  const blocks = text.split(/\n{2,}/);
  const preferred: string[] = [];
  const rest: string[] = [];
  for (const block of blocks) {
    if (
      /^#{1,4}\s/.test(block) ||
      /材料|作り方|手順|人分|調理時間|STEP/i.test(block) ||
      block.trim().startsWith("- ")
    ) {
      preferred.push(block);
    } else {
      rest.push(block);
    }
  }
  let out = "";
  for (const block of [...preferred, ...rest]) {
    const next = out ? `${out}\n\n${block}` : block;
    if (next.length > maxChars) break;
    out = next;
  }
  if (!out) out = text.slice(0, maxChars);
  return { text: out, truncated: true };
}

function rootLabel(el: Cheerio<AnyNode>): string {
  const tag = (el.get(0) as Element | undefined)?.name?.toLowerCase() ?? "unknown";
  const id = el.attr("id");
  const className = (el.attr("class") ?? "").trim().split(/\s+/).slice(0, 3).join(".");
  if (id) return `${tag}#${id}`;
  if (className) return `${tag}.${className}`;
  return tag;
}

function scoreRecipeRoot($: CheerioAPI, el: Cheerio<AnyNode>): number {
  const text = el.text().replace(/\s+/g, " ").trim();
  let score = Math.min(text.length, 20000) / 100;
  if (/材料|調味料|用意するもの/.test(text)) score += 80;
  if (/作り方|つくり方|手順|調理手順|STEP\s*\d+/i.test(text)) score += 80;
  if (el.is("main") || el.is('[role="main"]')) score += 20;
  if (el.is(".single-recipe, .recipe-template-default, .single")) score += 40;
  if (el.is("article.item, .item")) score -= 100;
  if (text.length < 200) score -= 50;
  if (text.length > 1500) score += 30;
  // カード一覧っぽい短文 article を避ける
  if (el.is("article") && text.length < 400 && !/材料|作り方|手順/.test(text)) {
    score -= 120;
  }
  void $;
  return score;
}

function probeCandidates($: CheerioAPI): PreprocessDebugInfo["candidateProbe"] {
  const probeSelectors = [
    "article",
    "main",
    '[role="main"]',
    ".recipe",
    ".recipe-detail",
    ".single",
    ".single-recipe",
    ".recipe-template-default",
    ".entry-content",
    "#body",
  ];
  return probeSelectors.map((selector) => {
    const nodes = $(selector);
    let bestChars = 0;
    let hasIngredients = false;
    let hasSteps = false;
    nodes.each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      bestChars = Math.max(bestChars, text.length);
      if (/材料|調味料/.test(text)) hasIngredients = true;
      if (/作り方|手順|STEP/i.test(text)) hasSteps = true;
    });
    return {
      selector,
      count: nodes.length,
      bestChars,
      hasIngredients,
      hasSteps,
    };
  });
}

/**
 * レシピ本文らしいルートを選ぶ。
 * 旧実装の「最初の article」は BONIQ の関連カードを誤選択するため、スコアリングする。
 */
export function selectRecipeRoot($: CheerioAPI): {
  root: Cheerio<AnyNode>;
  selectedRoot: string;
  selectedRootSelector: string;
} {
  type Best = {
    root: Cheerio<AnyNode>;
    score: number;
    selector: string;
  };
  const state: { best: Best | null } = { best: null };

  for (const selector of RECIPE_ROOT_CANDIDATES) {
    const nodes = $(selector);
    nodes.each((_, el) => {
      const candidate = $(el);
      const score = scoreRecipeRoot($, candidate);
      if (!state.best || score > state.best.score) {
        state.best = { root: candidate, score, selector };
      }
    });
  }

  if (!state.best || state.best.score < 5) {
    const body = $("body").first();
    return {
      root: body,
      selectedRoot: rootLabel(body),
      selectedRootSelector: "body(fallback)",
    };
  }

  return {
    root: state.best.root,
    selectedRoot: rootLabel(state.best.root),
    selectedRootSelector: state.best.selector,
  };
}

function logPreprocessDebug(info: PreprocessDebugInfo): void {
  if (!isDev()) return;
  const lines = [
    "",
    "════════════════════════════════════════════════════════",
    " HTML前処理 DOM選択結果（実測）",
    "════════════════════════════════════════════════════════",
    `selectedRoot:`,
    info.selectedRoot,
    `selectedRootSelector: ${info.selectedRootSelector}`,
    `本文抽出前文字数: ${info.charsBeforeExtract}`,
    `本文抽出後文字数: ${info.charsAfterExtract}`,
    `removeしたタグ数: ${info.removedTagCount}`,
    "",
    "候補調査 (article/main/.recipe/.single 等):",
    ...info.candidateProbe.map(
      (item) =>
        `  ${item.selector}: count=${item.count} bestChars=${item.bestChars} 材料=${item.hasIngredients} 手順=${item.hasSteps}`,
    ),
    "",
    "最後に残ったHTML先頭1000文字:",
    info.remainingHtmlHead1000 || "(empty)",
    "────────────────────────────────────────────────────────",
  ];
  console.info(lines.join("\n"));
}

/** AI入力用にページを前処理する */
export function preparePageForAi(html: string, pageUrl: string): AiPreparedPage {
  const $ = cheerio.load(html);
  const removedTagCount = removeNoise($);
  const candidateProbe = probeCandidates($);

  const pageTitle =
    $("title").first().text().trim() ||
    getMeta($, 'meta[property="og:title"]') ||
    null;
  const metaDescription =
    getMeta($, 'meta[property="og:description"]') ||
    getMeta($, 'meta[name="description"]');
  const canonicalUrl =
    getMeta($, 'link[rel="canonical"]', "href") || pageUrl;
  const siteName =
    getMeta($, 'meta[property="og:site_name"]') ||
    (() => {
      try {
        return new URL(pageUrl).hostname;
      } catch {
        return null;
      }
    })();

  const { root, selectedRoot, selectedRootSelector } = selectRecipeRoot($);
  const charsBeforeExtract = root.text().replace(/\s+/g, " ").trim().length;

  const lines: string[] = [];
  const headings: string[] = [];
  const sections: string[] = [];
  if (pageTitle) lines.push(`# ${pageTitle}`);

  root.children().each((_, child) => {
    serializeNode($, child, lines, headings, sections);
  });

  // 直下走査でほぼ取れない場合は descendant を走査
  if (lines.length <= 1 || lines.join("\n").length < 200) {
    root.find("h1, h2, h3, h4, p, ul, ol, table, li").each((_, el) => {
      serializeNode($, el, lines, headings, sections);
    });
  }

  const joined = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index, arr) => line !== arr[index - 1])
    .join("\n\n");

  const { text, truncated } = prioritizeAndTruncate(joined, MAX_CHARS);
  const remainingHtmlHead1000 = (root.html() ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);

  const preprocessDebug: PreprocessDebugInfo = {
    selectedRoot,
    selectedRootSelector,
    charsBeforeExtract,
    charsAfterExtract: text.length,
    removedTagCount,
    remainingHtmlHead1000,
    candidateProbe,
  };
  logPreprocessDebug(preprocessDebug);

  return {
    structuredText: text,
    pageTitle,
    metaDescription,
    canonicalUrl,
    siteName,
    detectedHeadings: headings.slice(0, 40),
    candidateSections: [...new Set(sections)].slice(0, 20),
    charCount: text.length,
    truncated,
    // 診断ログ出力は開発時のみ。構造体自体はテスト/回帰確認のため常に返す
    preprocessDebug,
  };
}

export const AI_PAGE_TEXT_MAX_CHARS = MAX_CHARS;
