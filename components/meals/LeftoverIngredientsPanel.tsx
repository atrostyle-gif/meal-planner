"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  deleteLeftoverIngredient,
  markLeftoversUsed,
  migrateInventoryToLeftovers,
  saveLeftoverIngredient,
  updateLeftoverIngredient,
} from "@/lib/leftover-ingredients";
import { useLeftoverIngredients } from "@/lib/use-leftover-ingredients";
import type {
  LeftoverIngredient,
  LeftoverPriority,
} from "@/types/leftover-ingredient";

type LeftoverIngredientsPanelProps = {
  householdId: string;
};

type FormState = {
  name: string;
  quantity: string;
  unit: string;
  priority: LeftoverPriority;
  notes: string;
};

const INITIAL_FORM: FormState = {
  name: "",
  quantity: "",
  unit: "",
  priority: "normal",
  notes: "",
};

const PRIORITY_OPTIONS: { value: LeftoverPriority; label: string }[] = [
  { value: "normal", label: "できれば" },
  { value: "soon", label: "早めに" },
  { value: "must_use", label: "優先して" },
];

function toForm(item: LeftoverIngredient): FormState {
  return {
    name: item.name,
    quantity: item.quantity?.toString() ?? "",
    unit: item.unit ?? "",
    priority: item.priority,
    notes: item.notes ?? "",
  };
}

function toQuantity(value: string): number | null {
  if (value.trim() === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function LeftoverIngredientsPanel({
  householdId,
}: LeftoverIngredientsPanelProps) {
  const items = useLeftoverIngredients();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  useEffect(() => {
    migrateInventoryToLeftovers(householdId);
  }, [householdId]);

  const visibleItems = items.filter(
    (item) =>
      item.householdId === householdId ||
      (householdId !== "local" && item.householdId === "local"),
  );

  function resetForm(): void {
    setForm(INITIAL_FORM);
    setAdding(false);
    setEditingId(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (form.name.trim() === "") return;
    const input = {
      name: form.name,
      quantity: toQuantity(form.quantity),
      unit: form.unit,
      priority: form.priority,
      notes: form.notes,
    };
    if (editingId) {
      updateLeftoverIngredient(editingId, input);
    } else {
      saveLeftoverIngredient({ ...input, householdId });
    }
    resetForm();
  }

  return (
    <section className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="block text-base font-semibold">余っている食材</span>
          <span className="mt-1 block text-xs text-on-surface-variant">
            余り食材を献立に活かします
          </span>
        </span>
        <span className="text-sm text-primary">{open ? "閉じる" : "開く"}</span>
      </button>

      {open ? (
        <div className="mt-4 space-y-4">
          {visibleItems.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              まだ余り食材はありません
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleItems.map((item) => (
                <li key={item.id} className="rounded-xl bg-surface-container p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {item.name}
                        {item.quantity != null
                          ? ` ${item.quantity}${item.unit ?? ""}`
                          : ""}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {PRIORITY_OPTIONS.find(
                          (option) => option.value === item.priority,
                        )?.label ?? "できれば"}
                        {item.notes ? ` ・${item.notes}` : ""}
                        {item.status === "used" ? " ・使用済み" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm(toForm(item));
                        setAdding(false);
                      }}
                      className="text-sm text-primary"
                    >
                      編集
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        updateLeftoverIngredient(item.id, {
                          includeInProposal: !item.includeInProposal,
                        })
                      }
                      className="rounded-lg px-2.5 py-1.5 ring-1 ring-outline-variant"
                    >
                      {item.includeInProposal
                        ? "提案に使わない"
                        : "提案に使う"}
                    </button>
                    {item.status !== "used" ? (
                      <button
                        type="button"
                        onClick={() => markLeftoversUsed([item.id])}
                        className="rounded-lg px-2.5 py-1.5 text-primary ring-1 ring-outline-variant"
                      >
                        使用済みにする
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => deleteLeftoverIngredient(item.id)}
                      className="rounded-lg px-2.5 py-1.5 text-error"
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {adding || editingId ? (
            <form onSubmit={handleSubmit} className="space-y-3 border-t border-outline-variant pt-4">
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="食材名"
                className="w-full rounded-xl bg-surface-container px-3 py-2.5 text-base"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.quantity}
                  onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                  placeholder="数量（任意）"
                  className="min-w-0 rounded-xl bg-surface-container px-3 py-2.5 text-sm"
                />
                <input
                  value={form.unit}
                  onChange={(event) => setForm({ ...form, unit: event.target.value })}
                  placeholder="単位（任意）"
                  className="min-w-0 rounded-xl bg-surface-container px-3 py-2.5 text-sm"
                />
              </div>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({
                    ...form,
                    priority: event.target.value as LeftoverPriority,
                  })
                }
                className="w-full rounded-xl bg-surface-container px-3 py-2.5 text-sm"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="メモ（任意）"
                className="w-full rounded-xl bg-surface-container px-3 py-2.5 text-sm"
              />
              <div className="flex gap-2">
                <button type="button" onClick={resetForm} className="flex-1 rounded-xl px-3 py-2.5 text-sm ring-1 ring-outline-variant">
                  キャンセル
                </button>
                <button type="submit" className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary">
                  保存
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="w-full rounded-xl bg-secondary-container px-3 py-2.5 text-sm font-semibold text-on-secondary-container">
              食材を追加
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
