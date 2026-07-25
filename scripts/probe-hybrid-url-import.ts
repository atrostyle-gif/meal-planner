import { assessJsonLdQuality } from "../lib/recipe-import/json-ld-quality";
import { runUrlImportPipeline } from "../lib/recipe-import/pipeline";
import { safeFetchHtml } from "../lib/recipe-import/safe-fetch";

async function probe(label: string, url: string): Promise<void> {
  try {
    const fetched = await safeFetchHtml(url);
    const quality = assessJsonLdQuality(fetched.html, fetched.finalUrl);
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const pipeline = await runUrlImportPipeline(fetched.html, fetched.finalUrl, {
      skipCache: true,
    });
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    console.log(
      JSON.stringify(
        {
          label,
          httpStatus: fetched.httpStatus,
          finalUrl: fetched.finalUrl,
          jsonLdSufficient: quality.sufficient,
          jsonLdIngredients: quality.ingredientCount,
          jsonLdSteps: quality.stepCount,
          pipelineCode: pipeline.code,
          importSource: pipeline.importSource,
          aiRan: pipeline.diagnostics.aiRan,
          title: pipeline.draft?.title ?? null,
          note: "OPENAI_API_KEY cleared for this probe",
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          label,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
  }
}

async function main(): Promise<void> {
  await probe("cookpad", "https://cookpad.com/recipe/1281453");
  await probe("example", "https://example.com/");
  await probe("boniq-top", "https://boniq.jp/");
}

void main();
