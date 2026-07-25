/**
 * BONIQ URL のハイブリッド取り込み実測確認
 * 使い方: npx tsx scripts/verify-boniq-pipeline.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { preparePageForAi } from "../lib/recipe-import/html/preprocess-for-ai";
import { runUrlImportPipeline } from "../lib/recipe-import/pipeline";
import { assertSafeUrl, safeFetchHtml } from "../lib/recipe-import/safe-fetch";

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const TARGET_URL = "https://boniq.jp/recipe/?post_type=recipe&p=46195";

async function main(): Promise<void> {
  loadEnvLocal();
  // 診断ログを出すため development 相当にする（read-only 回避）
  Object.defineProperty(process.env, "NODE_ENV", {
    value: "development",
    writable: true,
    configurable: true,
  });

  const fromFile = process.argv.includes("--from-file");
  const url = TARGET_URL;

  console.info("=== BONIQ pipeline verification ===");
  console.info("URL:", url);
  console.info("mode:", fromFile ? "debug-import.html" : "live-fetch");
  console.info("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "set" : "missing");

  let html: string;
  let finalUrl = url;
  let httpStatus = 200;
  let htmlBytes = 0;

  if (fromFile) {
    const filePath = resolve(process.cwd(), "debug-import.html");
    html = readFileSync(filePath, "utf8");
    htmlBytes = Buffer.byteLength(html, "utf8");
    console.info("HTTP: (from file)");
    console.info("htmlBytes:", htmlBytes);
  } else {
    const safe = await assertSafeUrl(url);
    const fetched = await safeFetchHtml(safe.toString());
    html = fetched.html;
    finalUrl = fetched.finalUrl;
    httpStatus = fetched.httpStatus;
    htmlBytes = fetched.htmlBytes;
    console.info("HTTP:", httpStatus);
    console.info("finalUrl:", finalUrl);
    console.info("htmlBytes:", htmlBytes);
  }

  const prepared = preparePageForAi(html, finalUrl);
  const debug = prepared.preprocessDebug;
  console.info("\n--- preprocess ---");
  console.info("selectedRoot:", debug?.selectedRoot ?? "(n/a)");
  console.info("selectedRootSelector:", debug?.selectedRootSelector ?? "(n/a)");
  console.info("charsBeforeExtract:", debug?.charsBeforeExtract ?? "(n/a)");
  console.info("charsAfterExtract / prepared.charCount:", prepared.charCount);
  console.info("removedTagCount:", debug?.removedTagCount ?? "(n/a)");
  console.info("candidateProbe:", JSON.stringify(debug?.candidateProbe ?? [], null, 2));
  console.info("preparedHead1000:\n", prepared.structuredText.slice(0, 1000));

  const result = await runUrlImportPipeline(html, finalUrl, {
    skipCache: true,
    forceAi: false,
  });

  console.info("\n--- pipeline result ---");
  console.info("code:", result.code);
  console.info("importSource:", result.importSource);
  console.info("FAILED_REASON:", result.diagnostics.failedReason);
  console.info("aiRan:", result.diagnostics.aiRan);
  console.info("successfulMethod:", result.diagnostics.successfulMethod);
  console.info("documentType:", result.draft?.documentType ?? "(null)");
  console.info("title:", result.draft?.title ?? "(null)");
  console.info("ingredients:", result.draft?.ingredients.length ?? 0);
  console.info("steps:", result.draft?.steps.length ?? 0);
  console.info("fieldSources:", JSON.stringify(result.draft?.fieldSources ?? {}));
  console.info("warnings:", result.draft?.warnings ?? []);
  console.info("userError:", result.userError);
  console.info("userMessage:", result.userMessage);

  if (result.draft?.ingredients[0]) {
    console.info("ingredient[0]:", JSON.stringify(result.draft.ingredients[0]));
  }
  if (result.draft?.steps[0]) {
    console.info("step[0]:", JSON.stringify(result.draft.steps[0]));
  }

  const ok =
    result.code === "ok" &&
    Boolean(result.draft?.title) &&
    (result.draft?.ingredients.length ?? 0) >= 1 &&
    (result.draft?.steps.length ?? 0) >= 1 &&
    result.diagnostics.failedReason == null &&
    (result.draft?.documentType === "recipe_page" ||
      result.draft?.documentType === "partial_recipe" ||
      result.importSource === "hybrid" ||
      result.importSource === "ai_html");

  console.info("\n=== VERDICT ===");
  console.info(ok ? "SUCCESS" : "FAILURE");
  process.exit(ok ? 0 : 1);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
