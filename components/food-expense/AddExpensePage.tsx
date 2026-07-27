"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  createManualExpense,
  previewManualExpense,
  type ManualExpenseInput,
} from "@/lib/food-expense/manual";
import { getToday } from "@/lib/date";
import { useIsClient } from "@/lib/use-is-client";
import {
  FOOD_EXPENSE_CATEGORIES,
  FOOD_EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type FoodExpenseCategory,
  type FoodExpenseLineInput,
  type PaymentMethod,
} from "@/types/food-expense";

type LineDraft = {
  key: string;
  name: string;
  amountYen: string;
  quantity: string;
  unit: string;
  ingredientName: string;
  addToInventory: boolean;
};

function emptyLine(): LineDraft {
  return {
    key: crypto.randomUUID(),
    name: "",
    amountYen: "",
    quantity: "",
    unit: "",
    ingredientName: "",
    addToInventory: false,
  };
}

export function AddExpensePage() {
  const isClient = useIsClient();
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [amountYen, setAmountYen] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(getToday());
  const [category, setCategory] = useState<FoodExpenseCategory>("unclassified");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("unknown");
  const [memo, setMemo] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    const lineInputs: FoodExpenseLineInput[] = showDetails
      ? lines
          .filter((line) => line.name.trim() && line.amountYen.trim())
          .map((line) => ({
            name: line.name.trim(),
            amountYen: Number(line.amountYen),
            quantity: line.quantity.trim() ? Number(line.quantity) : null,
            unit: line.unit.trim() || null,
            ingredientName: line.ingredientName.trim() || null,
            addToInventory: line.addToInventory,
            registerPrice: true,
          }))
      : [];
    const input: ManualExpenseInput = {
      purchasedAt: `${purchasedAt}T12:00:00.000Z`,
      storeName,
      totalAmountYen: Number(amountYen) || 0,
      category,
      paymentMethod,
      memo,
      lines: lineInputs,
    };
    return previewManualExpense(input);
  }, [
    amountYen,
    category,
    lines,
    memo,
    paymentMethod,
    purchasedAt,
    showDetails,
    storeName,
  ]);

  if (!isClient) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  function handleSave(): void {
    setMessage(null);
    if (!storeName.trim()) {
      setMessage("店舗を入力してください");
      return;
    }
    const yen = Number(amountYen);
    if (!Number.isFinite(yen) || yen <= 0) {
      setMessage("金額を入力してください");
      return;
    }
    setSaving(true);
    try {
      const lineInputs: FoodExpenseLineInput[] = showDetails
        ? lines
            .filter((line) => line.name.trim() && line.amountYen.trim())
            .map((line) => ({
              name: line.name.trim(),
              amountYen: Number(line.amountYen),
              quantity: line.quantity.trim() ? Number(line.quantity) : null,
              unit: line.unit.trim() || null,
              ingredientName: line.ingredientName.trim() || null,
              addToInventory: line.addToInventory,
              registerPrice: true,
            }))
        : [];
      createManualExpense({
        purchasedAt: `${purchasedAt}T12:00:00.000Z`,
        storeName,
        totalAmountYen: yen,
        category,
        paymentMethod,
        memo,
        lines: lineInputs,
      });
      router.push("/food-expenses");
    } catch {
      setMessage("登録に失敗しました");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link href="/food-expenses" className="text-sm text-primary">
        ← 食費レポート
      </Link>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">支出を追加</h1>
      </header>

      <div className="grid grid-cols-1 gap-2">
        <Link
          href="/receipts/import"
          className="rounded-xl bg-secondary-container px-4 py-3 text-center text-sm font-semibold text-on-secondary-container"
        >
          1. レシートから登録
        </Link>
      </div>

      <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <p className="text-sm font-semibold">2. 金額だけ登録</p>
        <label className="block space-y-1 text-sm">
          <span>店舗</span>
          <input
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            className="w-full rounded-xl bg-surface-container px-3 py-3 text-base"
            placeholder="八百屋・市場など"
            autoComplete="off"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>金額（円）</span>
          <input
            type="number"
            inputMode="numeric"
            value={amountYen}
            onChange={(event) => setAmountYen(event.target.value)}
            className="w-full rounded-xl bg-surface-container px-3 py-3 text-base"
            placeholder="1200"
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary disabled:opacity-50"
        >
          {saving ? "登録中…" : "登録"}
        </button>
      </section>

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="w-full rounded-xl bg-surface-container px-3 py-2.5 text-sm font-medium"
      >
        {showDetails ? "商品入力を閉じる" : "商品も入力する"}
      </button>

      {showDetails ? (
        <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <p className="text-sm font-semibold">3. 商品明細を入力</p>
          <label className="block space-y-1 text-sm">
            <span>日付</span>
            <input
              type="date"
              value={purchasedAt}
              onChange={(event) => setPurchasedAt(event.target.value)}
              className="w-full rounded-xl bg-surface-container px-3 py-2.5"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>カテゴリ（金額のみ時）</span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as FoodExpenseCategory)
              }
              className="w-full rounded-xl bg-surface-container px-3 py-2.5"
            >
              {FOOD_EXPENSE_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {FOOD_EXPENSE_CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>支払い方法</span>
            <select
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value as PaymentMethod)
              }
              className="w-full rounded-xl bg-surface-container px-3 py-2.5"
            >
              {PAYMENT_METHODS.map((key) => (
                <option key={key} value={key}>
                  {PAYMENT_METHOD_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>メモ</span>
            <input
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              className="w-full rounded-xl bg-surface-container px-3 py-2.5"
              placeholder="テイクアウトなど"
            />
          </label>

          <ul className="space-y-3">
            {lines.map((line, index) => (
              <li
                key={line.key}
                className="space-y-2 rounded-xl bg-surface-container p-3"
              >
                <p className="text-xs text-on-surface-variant">商品 {index + 1}</p>
                <input
                  value={line.name}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row) =>
                        row.key === line.key
                          ? { ...row, name: event.target.value }
                          : row,
                      ),
                    )
                  }
                  className="w-full rounded-xl bg-surface-container-lowest px-3 py-2 text-sm"
                  placeholder="商品名"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    value={line.amountYen}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((row) =>
                          row.key === line.key
                            ? { ...row, amountYen: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className="rounded-xl bg-surface-container-lowest px-2 py-2 text-sm"
                    placeholder="金額"
                  />
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((row) =>
                          row.key === line.key
                            ? { ...row, quantity: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className="rounded-xl bg-surface-container-lowest px-2 py-2 text-sm"
                    placeholder="数量"
                  />
                  <input
                    value={line.unit}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((row) =>
                          row.key === line.key
                            ? { ...row, unit: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className="rounded-xl bg-surface-container-lowest px-2 py-2 text-sm"
                    placeholder="単位"
                  />
                </div>
                <input
                  value={line.ingredientName}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row) =>
                        row.key === line.key
                          ? { ...row, ingredientName: event.target.value }
                          : row,
                      ),
                    )
                  }
                  className="w-full rounded-xl bg-surface-container-lowest px-3 py-2 text-sm"
                  placeholder="標準食材（任意）"
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={line.addToInventory}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((row) =>
                          row.key === line.key
                            ? { ...row, addToInventory: event.target.checked }
                            : row,
                        ),
                      )
                    }
                  />
                  在庫へ追加（既定OFF）
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setLines((current) => [...current, emptyLine()])}
            className="w-full rounded-xl bg-surface-container px-3 py-2 text-sm font-medium"
          >
            商品を追加
          </button>

          <div className="space-y-1 rounded-xl bg-surface-container px-3 py-3 text-sm">
            <p>食費として登録: {preview.foodExpenseTotalYen.toLocaleString()}円</p>
            <p>価格履歴へ登録: {preview.priceHistoryCandidateCount}件</p>
            <p>在庫へ追加: {preview.inventoryCandidateCount}件</p>
            {preview.amountMismatch ? (
              <p className="text-error">
                内訳合計（{preview.lineSumYen.toLocaleString()}円）と支払額が違います
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary disabled:opacity-50"
          >
            {saving ? "登録中…" : "明細つきで登録"}
          </button>
        </section>
      ) : null}

      {message ? <p className="text-sm text-error">{message}</p> : null}
    </div>
  );
}
