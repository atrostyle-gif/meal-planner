import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { preparePageForAi } from "@/lib/recipe-import/html/preprocess-for-ai";

function loadDebugImportHtml(): string | null {
  const filePath = path.join(process.cwd(), "debug-import.html");
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf8");
}

describe("HTML前処理ルート選択回帰", () => {
  it("短いarticleカードを選ばない", () => {
    const html = `<!DOCTYPE html><html><body class="single single-recipe" id="body">
      <article class="item"><h3>関連カードA</h3><p>短い紹介</p></article>
      <article class="item"><h3>関連カードB</h3><p>短い紹介</p></article>
      <div class="entry">
        <h1>本命レシピ</h1>
        <h3>材料</h3><ul><li>豚肉 300g</li><li>塩 少々</li></ul>
        <h3>作り方</h3><ol><li>塩を振る</li><li>焼く</li></ol>
      </div>
    </body></html>`;
    const prepared = preparePageForAi(html, "https://example.com/recipe");
    expect(prepared.structuredText).toContain("豚肉");
    expect(prepared.structuredText).toContain("焼く");
    expect(prepared.preprocessDebug?.selectedRootSelector).not.toBe("article");
    expect(prepared.charCount).toBeGreaterThan(50);
  });

  it("mainがないページでも本文候補をスコアリングできる", () => {
    const html = `<!DOCTYPE html><html><body>
      <div class="sidebar"><h2>おすすめ</h2><p>別記事</p></div>
      <div id="content" class="single-recipe">
        <h1>メイン料理</h1>
        <h2>材料</h2><ul><li>玉ねぎ 1個</li><li>にんじん 1本</li></ul>
        <h2>手順</h2><p>切る</p><p>煮込む</p>
      </div>
    </body></html>`;
    const prepared = preparePageForAi(html, "https://example.com/no-main");
    expect(prepared.structuredText).toContain("玉ねぎ");
    expect(prepared.structuredText).toContain("煮込む");
    expect(prepared.structuredText).not.toContain("別記事");
    expect(prepared.charCount).toBeGreaterThan(40);
  });

  it("関連レシピ一覧を材料・手順として混入しない", () => {
    const html = `<!DOCTYPE html><html><body class="single">
      <h1>本体</h1>
      <h2>材料</h2><ul><li>塩 1g</li></ul>
      <h2>作り方</h2><p>混ぜる</p>
      <h2>関連レシピ</h2>
      <ul>
        <li>別の人気レシピA 999g</li>
        <li>別の人気レシピB 888g</li>
      </ul>
    </body></html>`;
    const prepared = preparePageForAi(html, "https://example.com/related");
    expect(prepared.structuredText).toContain("塩");
    expect(prepared.structuredText).toContain("混ぜる");
    expect(prepared.structuredText).not.toContain("別の人気レシピA");
    expect(prepared.structuredText).not.toContain("999g");
  });

  it("BONIQ保存HTMLを使った回帰（debug-import.html）", () => {
    const html = loadDebugImportHtml();
    if (!html) {
      // 保存HTMLが無い環境ではスキップ扱い（失敗にしない）
      expect(true).toBe(true);
      return;
    }
    const prepared = preparePageForAi(html, "https://boniq.jp/recipe/?p=46195");
    expect(prepared.charCount).toBeGreaterThan(500);
    expect(prepared.structuredText).toMatch(/材料/);
    expect(prepared.structuredText).toMatch(/手順|作り方/);
    expect(prepared.structuredText).toMatch(/豚ばら|ポッサム/);
    expect(prepared.preprocessDebug?.selectedRootSelector).not.toBe("article");
    const articleProbe = prepared.preprocessDebug?.candidateProbe.find(
      (item) => item.selector === "article",
    );
    const singleProbe = prepared.preprocessDebug?.candidateProbe.find(
      (item) => item.selector === ".single" || item.selector === ".single-recipe",
    );
    expect(articleProbe?.hasIngredients).toBe(false);
    expect(singleProbe?.hasIngredients || singleProbe?.hasSteps).toBe(true);
  });
});
