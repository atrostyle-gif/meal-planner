import type { CheerioAPI } from "cheerio";
import type { RecipeDraft } from "@/types/recipe-import";
import type { HtmlRuleExtraction } from "@/lib/recipe-import/html/rules";

export type RecipeSiteAdapterResult = {
  draft: RecipeDraft | null;
  detectedSections: string[];
  ingredientCandidateCount: number;
  stepCandidateCount: number;
  excludedCount: number;
  adapterName: string;
};

export type RecipeSiteAdapter = {
  name: string;
  canHandle: (url: string, html: string) => boolean;
  extract: (
    $: CheerioAPI,
    url: string,
    og: {
      title: string | null;
      description: string | null;
      image: string | null;
      author: string | null;
    },
    generic: HtmlRuleExtraction,
  ) => RecipeSiteAdapterResult;
};
