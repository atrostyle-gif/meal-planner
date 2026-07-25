import { writeFileSync } from "node:fs";

async function fetchWithUa(url: string, ua: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": ua,
    },
    redirect: "follow",
  });
  const html = await response.text();
  const ldCount = (html.match(/application\/ld\+json/gi) ?? []).length;
  const hasRecipe = /"@type"\s*:\s*"Recipe"/i.test(html);
  return {
    ua,
    status: response.status,
    finalUrl: response.url,
    bytes: html.length,
    ldCount,
    hasRecipe,
    head: html.slice(0, 300).replace(/\s+/g, " "),
  };
}

async function main(): Promise<void> {
  const url = "https://cookpad.com/recipe/1281453";
  const results = [
    await fetchWithUa(url, "meal-planner-recipe-import/1.0"),
    await fetchWithUa(
      url,
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    ),
  ];
  writeFileSync("debug-ua.json", JSON.stringify(results, null, 2), "utf8");
}

void main();
