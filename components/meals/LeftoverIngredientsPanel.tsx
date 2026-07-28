"use client";

import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  deleteLeftoverIngredient,
  getPreviousLeftoverNameSuggestions,
  saveLeftoverIngredient,
  updateLeftoverIngredient,
} from "@/lib/leftover-ingredients";
import { useLeftoverIngredients } from "@/lib/use-leftover-ingredients";
import type { LeftoverIngredient, LeftoverUsageSummary } from "@/types/leftover-ingredient";

type LeftoverIngredientsPanelProps = {
  householdId: string;
  weekStart: string;
  usageSummary?: LeftoverUsageSummary | null;
};

export function LeftoverIngredientsPanel({
  householdId,
  weekStart,
  usageSummary = null,
}: LeftoverIngredientsPanelProps) {
  const allItems = useLeftoverIngredients();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quantityDraft, setQuantityDraft] = useState("");
  const [showUsageDetail, setShowUsageDetail] = useState(false);

  const items = useMemo(
    () =>
      allItems.filter(
        (item) =>
          item.weekStart === weekStart &&
          (item.householdId === householdId || item.householdId === "local") &&
          item.status !== "dismissed",
      ),
    [allItems, householdId, weekStart],
  );

  const suggestions = useMemo(() => {
    return getPreviousLeftoverNameSuggestions(weekStart, 6).filter(
      (name) => !items.some((item) => item.name === name),
    );
  }, [items, weekStart]);

  function addName(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = items.some(
      (item) =>
        item.name === trimmed ||
        item.rawName === trimmed ||
        item.normalizedName === trimmed.toLowerCase(),
    );
    if (exists) {
      setDraft("");
      return;
    }
    saveLeftoverIngredient({
      name: trimmed,
      rawName: trimmed,
      householdId,
      weekStart,
      source: "manual_meal_plan",
      quantityText: null,
      includeInProposal: true,
    });
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    addName(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      addName(draft);
    }
  }

  function openEdit(item: LeftoverIngredient): void {
    setEditingId(item.id);
    setQuantityDraft(item.quantityText ?? "");
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">余っている食材</h2>
        <span className="text-xs text-on-surface-variant">今週使い切り</span>
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary-container px-3 py-1.5 text-sm text-on-secondary-container"
              >
                <span className="truncate">
                  {item.name}
                  {item.quantityText ? ` ${item.quantityText}` : ""}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.name}を削除`}
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteLeftoverIngredient(item.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      deleteLeftoverIngredient(item.id);
                    }
                  }}
                  className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs opacity-80"
                >
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="食材名を入力"
          autoComplete="off"
          enterKeyHint="done"
          className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface-container-lowest px-3 py-2 text-base ring-1 ring-outline-variant"
          list="leftover-suggestions"
        />
        <datalist id="leftover-suggestions">
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-secondary-container px-3 py-2 text-sm font-semibold text-on-secondary-container"
        >
          ＋追加
        </button>
      </form>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <span className="w-full text-xs text-on-surface-variant">
            前回の食材（選んだものだけ使う）
          </span>
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => addName(name)}
              className="rounded-full px-2.5 py-1 text-xs ring-1 ring-outline-variant"
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {editingId ? (
        <div className="rounded-xl bg-surface-container p-3 space-y-2">
          <p className="text-sm font-medium">
            {items.find((item) => item.id === editingId)?.name}
          </p>
          <label className="block space-y-1 text-sm">
            <span className="text-on-surface-variant">数量（任意）</span>
            <input
              value={quantityDraft}
              onChange={(event) => setQuantityDraft(event.target.value)}
              placeholder="例: 1/2玉、200g"
              className="min-h-11 w-full rounded-xl px-3 py-2 ring-1 ring-outline-variant"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                updateLeftoverIngredient(editingId, {
                  quantityText: quantityDraft.trim() || null,
                });
                setEditingId(null);
              }}
              className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => {
                deleteLeftoverIngredient(editingId);
                setEditingId(null);
              }}
              className="rounded-xl px-3 py-2 text-sm text-error"
            >
              削除
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-xl px-3 py-2 text-sm ring-1 ring-outline-variant"
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}

      {usageSummary &&
      (usageSummary.used.length > 0 || usageSummary.unused.length > 0) ? (
        <div className="rounded-xl bg-surface-container-lowest px-3 py-2 ring-1 ring-outline-variant">
          <button
            type="button"
            onClick={() => setShowUsageDetail((value) => !value)}
            className="flex w-full items-center justify-between text-left text-sm"
          >
            <span className="font-medium">余り食材の活用</span>
            <span className="text-xs text-primary">
              {showUsageDetail ? "閉じる" : "詳細"}
            </span>
          </button>
          <ul className="mt-1 space-y-0.5 text-sm text-on-surface-variant">
            {usageSummary.used.map((line) => (
              <li key={line.id}>
                {line.name}　{line.recipeCount}品で使用
              </li>
            ))}
            {usageSummary.unused.map((line) => (
              <li key={line.id}>{line.name}　未使用</li>
            ))}
          </ul>
          {showUsageDetail && usageSummary.unused.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
              {usageSummary.unused.map((line) => (
                <li key={`detail-${line.id}`}>
                  {line.name}を使える候補が見つかりませんでした
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
