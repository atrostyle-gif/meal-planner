import { writeFileSync } from "node:fs";
import { safeFetchHtml } from "../lib/recipe-import/safe-fetch";
import {
  diagnoseJsonLd,
  saveDebugImportHtml,
} from "../lib/recipe-import/url-import-debug";

async function main(): Promise<void> {
  const urls = [
    "https://cookpad.com/recipe/1281453",
    "https://boniq.jp/",
  ];
  const out: unknown[] = [];
  for (const url of urls) {
    try {
      const r = await safeFetchHtml(url);
      const d = diagnoseJsonLd(r.html);
      if (url.includes("cookpad")) {
        await saveDebugImportHtml(r.html, true);
      }
      out.push({
        url,
        ok: true,
        status: r.httpStatus,
        type: r.contentType,
        bytes: r.htmlBytes,
        final: r.finalUrl,
        scripts: d.scripts.length,
        types: d.allTypes,
        reason: d.failureReason,
        detail: d.failureDetail,
        head: r.html.slice(0, 800).replace(/\s+/g, " "),
      });
    } catch (error) {
      const err = error as {
        code?: string;
        message?: string;
        httpStatus?: number;
        contentType?: string | null;
      };
      out.push({
        url,
        ok: false,
        code: err.code,
        message: err.message,
        status: err.httpStatus,
        type: err.contentType,
      });
    }
  }
  writeFileSync("debug-probe.json", JSON.stringify(out, null, 2), "utf8");
}

void main();
