import * as cheerio from "cheerio";
import { readFileSync } from "node:fs";
import { preparePageForAi } from "../lib/recipe-import/html/preprocess-for-ai";

const html = readFileSync("debug-import.html", "utf8");
console.log("htmlBytes", html.length);

const $ = cheerio.load(html);
const selectors = [
  "article",
  "main",
  '[role="main"]',
  ".recipe",
  ".recipe-detail",
  ".single",
  ".entry-content",
  "#content",
  ".content",
  ".post",
  ".page",
  ".blog",
  ".article",
];

for (const sel of selectors) {
  const els = $(sel);
  console.log(`\n${sel} count=${els.length}`);
  els.each((i, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    const cls = `${$(el).attr("class") ?? ""} #${$(el).attr("id") ?? ""}`;
    const hasZairyo = /材料/.test(t);
    const hasTsukuri = /作り方|手順|STEP/.test(t);
    console.log(
      `  [${i}] chars=${t.length} 材料=${hasZairyo} 手順=${hasTsukuri} class/id=${cls.slice(0, 100)}`,
    );
    if (hasZairyo || hasTsukuri) {
      console.log(`     head=${t.slice(0, 160)}`);
    }
  });
}

console.log("\n--- main direct children ---");
$("main")
  .first()
  .children()
  .each((_, el) => {
    const tag = (el as { name?: string }).name ?? "?";
    const cls = ((el as { attribs?: { class?: string } }).attribs?.class ?? "").slice(0, 80);
    const len = $(el).text().replace(/\s+/g, " ").trim().length;
    console.log(tag, cls, "textlen", len);
  });

console.log("\n--- article direct children ---");
$("article")
  .first()
  .children()
  .each((_, el) => {
    const tag = (el as { name?: string }).name ?? "?";
    const cls = ((el as { attribs?: { class?: string } }).attribs?.class ?? "").slice(0, 80);
    const len = $(el).text().replace(/\s+/g, " ").trim().length;
    console.log(tag, cls, "textlen", len);
  });

console.log("\nbody text len", $("body").text().replace(/\s+/g, " ").trim().length);
console.log("\nheadings:");
$("h1, h2, h3, h4")
  .slice(0, 40)
  .each((_, el) => {
    console.log($(el).prop("tagName"), $(el).text().replace(/\s+/g, " ").trim().slice(0, 100));
  });

// Simulate root selection
const root =
  $("main").first().length > 0
    ? { name: "main", el: $("main").first() }
    : $('[role="main"]').first().length > 0
      ? { name: "role=main", el: $('[role="main"]').first() }
      : $("article").first().length > 0
        ? { name: "article", el: $("article").first() }
        : { name: "body", el: $("body").first() };
console.log("\nSELECTED ROOT (current logic):", root.name, "textlen", root.el.text().replace(/\s+/g, " ").trim().length);

const prepared = preparePageForAi(html, "https://boniq.store/");
console.log("\npreparePageForAi charCount", prepared.charCount);
console.log("prepared text:\n", prepared.structuredText);
console.log("headings detected", prepared.detectedHeadings);
