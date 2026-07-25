import { readFileSync, writeFileSync } from "node:fs";
import { findLdJsonScriptContents } from "../lib/recipe-import/url-import-debug";

const html = readFileSync("debug-import.html", "utf8");
const old =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
let oldCount = 0;
while (old.exec(html)) oldCount += 1;
const flexible = findLdJsonScriptContents(html);

writeFileSync(
  "debug-regex.json",
  JSON.stringify(
    {
      oldRegexCount: oldCount,
      flexibleCount: flexible.length,
      flexiblePreviews: flexible.map((item) => item.slice(0, 120)),
    },
    null,
    2,
  ),
  "utf8",
);
