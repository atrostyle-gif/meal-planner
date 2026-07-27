import {
  classifyFoodExpenseCategory,
  defaultFoodExpenseExcluded,
} from "@/lib/food-expense/classify";
import type { ReceiptConfirmState, ReceiptDraft } from "@/types/receipt";

const DRAFT_KEY = "meal-planner:receiptDraft";
const CONFIRM_KEY = "meal-planner:receiptConfirm";

export function saveReceiptDraftSession(draft: ReceiptDraft): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadReceiptDraftSession(): ReceiptDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReceiptDraft;
  } catch {
    return null;
  }
}

export function saveReceiptConfirmSession(state: ReceiptConfirmState): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CONFIRM_KEY, JSON.stringify(state));
}

export function loadReceiptConfirmSession(): ReceiptConfirmState | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(CONFIRM_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as ReceiptConfirmState;
    // 旧セッション互換
    state.duplicateStatus = state.duplicateStatus ?? "new_receipt";
    state.duplicateReason = state.duplicateReason ?? null;
    state.items = (state.items ?? []).map((item) => {
      const category = classifyFoodExpenseCategory(
        item.ingredientName || item.rawName,
      );
      return {
        ...item,
        warnings: item.warnings ?? [],
        foodCode: item.foodCode ?? null,
        addToInventory: item.addToInventory ?? false,
        addToPriceHistory: item.addToPriceHistory ?? item.include !== false,
        foodExpenseCategory: item.foodExpenseCategory ?? category,
        foodExpenseExcluded:
          typeof item.foodExpenseExcluded === "boolean"
            ? item.foodExpenseExcluded
            : defaultFoodExpenseExcluded(category),
      };
    });
    return state;
  } catch {
    return null;
  }
}

export function clearReceiptSessions(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DRAFT_KEY);
  window.sessionStorage.removeItem(CONFIRM_KEY);
}
