"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { unitPriceDisplay } from "@/lib/receipt/confirm";
import {
  loadReceiptConfirmSession,
  saveReceiptConfirmSession,
  clearReceiptSessions,
} from "@/lib/receipt/draft-session";
import { saveConfirmedReceipt } from "@/lib/receipt/save";
import { getStoreRepository } from "@/lib/stores/store-repository";
import { useIsClient } from "@/lib/use-is-client";
import type { ReceiptConfirmItem, ReceiptConfirmState } from "@/types/receipt";

export function ReceiptConfirmPage() {
  const isClient = useIsClient();
  const router = useRouter();
  const [state, setState] = useState<ReceiptConfirmState | null>(() =>
    typeof window === "undefined" ? null : loadReceiptConfirmSession(),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const stores = isClient ? getStoreRepository().list() : [];

  if (!isClient) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  if (!state) {
    return (
      <div className="space-y-3">
        <p className="text-sm">確認中のレシートがありません</p>
        <Link href="/receipts/import" className="text-primary">
          レシート取込へ
        </Link>
      </div>
    );
  }

  function updateItem(
    key: string,
    patch: Partial<ReceiptConfirmItem>,
  ): void {
    setState((current) => {
      if (!current) return current;
      const next = {
        ...current,
        items: current.items.map((item) =>
          item.key === key ? { ...item, ...patch } : item,
        ),
      };
      saveReceiptConfirmSession(next);
      return next;
    });
  }

  function handleSave(forceDuplicate = false): void {
    if (!state) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = saveConfirmedReceipt(state, { forceDuplicate });
      if (result.skippedDuplicate) {
        setMessage(
          "同じレシートの可能性があります。内容を確認し、必要なら再登録してください。",
        );
        setSaving(false);
        return;
      }
      clearReceiptSessions();
      router.push(
        `/receipts/done?count=${result.savedPriceCount}&id=${result.receiptId}&checked=${result.checkedShoppingCount}`,
      );
    } catch {
      setMessage("保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-on-surface-variant">手順 2 / 3</p>
        <h1 className="text-2xl font-bold tracking-tight">内容を確認</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          確認が必要な項目だけ直して、登録してください
        </p>
      </header>

      {state.duplicateStatus === "exact_duplicate" ||
      state.duplicateStatus === "probable_duplicate" ? (
        <div className="rounded-2xl bg-error-container px-4 py-3 text-sm text-error">
          {state.duplicateStatus === "exact_duplicate"
            ? "同じレシートが既に登録されています。"
            : "似たレシートがあります（重複の可能性）。"}
          {state.duplicateReason ? (
            <span className="mt-1 block text-xs opacity-90">
              {state.duplicateReason}
            </span>
          ) : null}
          <button
            type="button"
            className="mt-2 font-semibold underline"
            onClick={() => handleSave(true)}
          >
            確認のうえ登録する
          </button>
        </div>
      ) : null}

      <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <label className="block space-y-1 text-sm">
          <span>店舗</span>
          <input
            value={state.storeName}
            onChange={(event) => {
              const next = { ...state, storeName: event.target.value };
              setState(next);
              saveReceiptConfirmSession(next);
            }}
            className="w-full rounded-xl bg-surface-container px-3 py-2.5"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>店舗の扱い</span>
          <select
            value={state.storeAction}
            onChange={(event) => {
              const action = event.target.value as ReceiptConfirmState["storeAction"];
              const next = { ...state, storeAction: action };
              setState(next);
              saveReceiptConfirmSession(next);
            }}
            className="w-full rounded-xl bg-surface-container px-3 py-2.5"
          >
            <option value="pending">未選択</option>
            <option value="create_new">新しい店舗として登録</option>
            <option value="link_existing">既存店舗へ統合</option>
          </select>
        </label>
        {state.storeAction === "link_existing" ? (
          <label className="block space-y-1 text-sm">
            <span>統合先</span>
            <select
              value={state.storeId ?? ""}
              onChange={(event) => {
                const store = stores.find((s) => s.id === event.target.value);
                const next = {
                  ...state,
                  storeId: event.target.value || null,
                  storeName: store?.name ?? state.storeName,
                };
                setState(next);
                saveReceiptConfirmSession(next);
              }}
              className="w-full rounded-xl bg-surface-container px-3 py-2.5"
            >
              <option value="">選択してください</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block space-y-1 text-sm">
          <span>購入日</span>
          <input
            type="date"
            value={state.purchasedAt?.slice(0, 10) ?? ""}
            onChange={(event) => {
              const next = {
                ...state,
                purchasedAt: event.target.value
                  ? `${event.target.value}T12:00:00.000Z`
                  : null,
              };
              setState(next);
              saveReceiptConfirmSession(next);
            }}
            className="w-full rounded-xl bg-surface-container px-3 py-2.5"
          />
        </label>
      </section>

      <ul className="space-y-3">
        {state.items.map((item) => (
          <li
            key={item.key}
            className={`rounded-2xl p-3 ring-1 ${
              item.needsReview
                ? "bg-secondary-container/40 ring-primary/40"
                : "bg-surface-container-lowest ring-outline-variant"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{item.rawName}</p>
                <p className="text-sm text-on-surface-variant">
                  {item.totalPriceYen != null
                    ? `${item.totalPriceYen.toLocaleString("ja-JP")}円`
                    : "金額不明"}
                  {item.packageQuantity != null
                    ? `・${item.packageQuantity}${item.packageUnit ?? ""}`
                    : ""}
                </p>
                <p className="text-sm">
                  → {item.ingredientName}
                  {item.needsReview ? (
                    <span className="ml-1 text-xs text-error">確認が必要</span>
                  ) : null}
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={item.include}
                  onChange={(event) =>
                    updateItem(item.key, {
                      include: event.target.checked,
                      addToPriceHistory: event.target.checked,
                    })
                  }
                />
                登録
              </label>
            </div>
            {item.needsReview ? (
              <>
                <label className="mt-2 block space-y-1 text-sm">
                  <span>標準食材</span>
                  <input
                    value={item.ingredientName}
                    onChange={(event) =>
                      updateItem(item.key, {
                        ingredientName: event.target.value,
                        needsReview: false,
                      })
                    }
                    className="w-full rounded-xl bg-surface-container px-3 py-2"
                  />
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block space-y-1 text-sm">
                    <span>価格（円）</span>
                    <input
                      type="number"
                      value={item.totalPriceYen ?? ""}
                      onChange={(event) =>
                        updateItem(item.key, {
                          totalPriceYen:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                      className="w-full rounded-xl bg-surface-container px-3 py-2"
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span>容量</span>
                    <input
                      value={
                        item.packageQuantity != null
                          ? `${item.packageQuantity}${item.packageUnit ?? ""}`
                          : ""
                      }
                      onChange={(event) => {
                        const text = event.target.value.trim();
                        const match = text.match(/^([\d.]+)\s*(.*)$/);
                        updateItem(item.key, {
                          packageQuantity: match ? Number(match[1]) : null,
                          packageUnit: match?.[2] || item.packageUnit,
                        });
                      }}
                      className="w-full rounded-xl bg-surface-container px-3 py-2"
                      placeholder="1kg"
                    />
                  </label>
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.foodExpenseExcluded}
                    onChange={(event) =>
                      updateItem(item.key, {
                        foodExpenseExcluded: event.target.checked,
                      })
                    }
                  />
                  食費から除外
                </label>
                <p className="mt-2 text-xs text-on-surface-variant">
                  {unitPriceDisplay(item)}
                  {item.mappingConfidence != null
                    ? `・信頼度 ${Math.round(item.mappingConfidence * 100)}%`
                    : ""}
                  {item.foodExpenseCategory
                    ? `・${item.foodExpenseCategory}`
                    : ""}
                </p>
                {item.warnings.length > 0 ? (
                  <p className="mt-1 text-xs text-error">
                    {item.warnings.join(" / ")}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-xs text-on-surface-variant">
                {unitPriceDisplay(item)}
              </p>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={saving}
        onClick={() => handleSave(false)}
        className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary disabled:opacity-50"
      >
        {saving ? "登録中…" : "確認して価格履歴へ登録"}
      </button>
      {message ? <p className="text-sm text-error">{message}</p> : null}
      <Link href="/receipts/import" className="block text-center text-sm text-primary">
        撮り直す
      </Link>
    </div>
  );
}
