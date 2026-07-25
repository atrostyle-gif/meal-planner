import type { RecipeDraft } from "@/types/recipe-import";

const KEY = "meal-planner:importDraft";

export function saveImportDraft(draft: RecipeDraft): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function loadImportDraft(): RecipeDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as { ingredients?: unknown }).ingredients) ||
      !Array.isArray((parsed as { steps?: unknown }).steps)
    ) {
      return null;
    }
    return parsed as RecipeDraft;
  } catch {
    return null;
  }
}

export function clearImportDraft(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}
