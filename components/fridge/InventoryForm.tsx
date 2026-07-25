"use client";

import { useState, type FormEvent } from "react";
import {
  AMOUNT_PRESET_LABELS,
  AMOUNT_PRESETS,
  type AmountPreset,
  type InventoryInput,
  type InventoryItem,
} from "@/types/inventory";

type InventoryFormProps = {
  initialItem?: InventoryItem;
  submitLabel: string;
  onSubmit: (input: InventoryInput) => void;
  onDelete?: () => void;
};

function getInitialPreset(item?: InventoryItem): AmountPreset | null {
  if (item?.amount?.kind === "preset") {
    return item.amount.preset;
  }
  return null;
}

function getInitialText(item?: InventoryItem): string {
  if (item?.amount?.kind === "text") {
    return item.amount.value;
  }
  return "";
}

export function InventoryForm({
  initialItem,
  submitLabel,
  onSubmit,
  onDelete,
}: InventoryFormProps) {
  const [name, setName] = useState(initialItem?.name ?? "");
  const [unit, setUnit] = useState(initialItem?.unit ?? "");
  const [priority, setPriority] = useState(initialItem?.priority ?? false);
  const [selectedPreset, setSelectedPreset] = useState<AmountPreset | null>(() =>
    getInitialPreset(initialItem),
  );
  const [amountText, setAmountText] = useState(() => getInitialText(initialItem));
  const [error, setError] = useState<string | null>(null);

  function handlePresetClick(preset: AmountPreset): void {
    setSelectedPreset(preset);
    // プリセット選択時は自由記述をクリアして混在を防ぐ
    setAmountText("");
  }

  function handleAmountTextChange(value: string): void {
    setAmountText(value);
    if (value.trim() !== "") {
      setSelectedPreset(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (name.trim() === "") {
      setError("食材名を入力してください。");
      return;
    }

    const trimmedText = amountText.trim();
    const amount =
      selectedPreset !== null
        ? ({ kind: "preset", preset: selectedPreset } as const)
        : trimmedText !== ""
          ? ({ kind: "text", value: trimmedText } as const)
          : null;

    setError(null);
    onSubmit({
      name,
      amount,
      unit,
      priority,
    });
  }

  function handleDelete(): void {
    if (!onDelete) {
      return;
    }

    const confirmed = window.confirm(
      `「${name || "この食材"}」を削除しますか？`,
    );
    if (confirmed) {
      onDelete();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-on-surface">食材名（必須）</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-xl border-0 bg-surface-container px-4 py-3 text-base text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          placeholder="例: 玉ねぎ"
        />
      </label>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-on-surface">残量</legend>
        <div className="flex flex-wrap gap-2">
          {AMOUNT_PRESETS.map((preset) => {
            const active = selectedPreset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className={`rounded-2xl px-4 py-2.5 text-sm font-medium ${
                  active
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface ring-1 ring-outline-variant"
                }`}
              >
                {AMOUNT_PRESET_LABELS[preset]}
              </button>
            );
          })}
        </div>
        <label className="block space-y-2">
          <span className="text-sm text-on-surface-variant">
            または数値・自由記述
          </span>
          <input
            type="text"
            value={amountText}
            onChange={(event) => handleAmountTextChange(event.target.value)}
            className="w-full rounded-xl border-0 bg-surface-container px-4 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
            placeholder="例: 2、適量"
          />
        </label>
      </fieldset>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-on-surface">単位</span>
        <input
          type="text"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          className="w-full rounded-xl border-0 bg-surface-container px-4 py-3 text-base outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          placeholder="例: 個、g、本"
        />
      </label>

      <button
        type="button"
        onClick={() => setPriority((current) => !current)}
        className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left ring-1 ${
          priority
            ? "bg-priority-container text-on-priority-container ring-priority"
            : "bg-surface-container-lowest text-on-surface ring-outline-variant"
        }`}
        aria-pressed={priority}
      >
        <span>
          <span className="block text-sm font-medium">優先して使う</span>
          <span className="mt-1 block text-xs opacity-80">
            献立の自動作成で優先候補になります
          </span>
        </span>
        <span className="text-2xl" aria-hidden>
          {priority ? "⭐" : "☆"}
        </span>
      </button>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <div className="space-y-3 pt-2">
        <button
          type="submit"
          className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary shadow-sm"
        >
          {submitLabel}
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full rounded-2xl px-4 py-3.5 text-base font-medium text-error hover:bg-error-container"
          >
            食材を削除
          </button>
        ) : null}
      </div>
    </form>
  );
}
