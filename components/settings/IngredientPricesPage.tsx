"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  addIngredientPrice,
  removeIngredientPrice,
} from "@/lib/food-budget/prices";
import {
  analyzeIngredientPrice,
  calculateBuyScore,
  shortAssessmentPhrase,
} from "@/lib/price-learning";
import { getPriceLearningStats } from "@/lib/receipt/stats";
import { useFoodBudgetSettings, useIngredientPrices } from "@/lib/use-food-budget";
import { ensurePrimaryStoreByName } from "@/lib/stores/store-repository";

function formatYen(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

export function IngredientPricesPage() {
  const settings = useFoodBudgetSettings();
  const prices = useIngredientPrices();
  const stats = useMemo(() => {
    void prices.length;
    return getPriceLearningStats();
  }, [prices]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("kg");
  const [grams, setGrams] = useState("");
  const [memo, setMemo] = useState("");
  const [isSale, setIsSale] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const purchasePriceYen = Number(price);
    const packageQuantity = Number(quantity);
    if (!name.trim()) {
      setMessage("品名を入力してください");
      return;
    }
    if (!Number.isFinite(purchasePriceYen) || purchasePriceYen <= 0) {
      setMessage("購入金額を正しく入力してください");
      return;
    }
    if (!Number.isFinite(packageQuantity) || packageQuantity <= 0) {
      setMessage("パック数量を正しく入力してください");
      return;
    }
    const gramsEquivalent =
      grams.trim() === "" ? null : Number(grams);
    if (gramsEquivalent !== null && !Number.isFinite(gramsEquivalent)) {
      setMessage("グラム換算は数字で入力してください");
      return;
    }

    const store = ensurePrimaryStoreByName(
      settings.primaryStoreName || "ロピア",
    );
    addIngredientPrice({
      ingredientName: name,
      storeName: store.name,
      storeId: store.id,
      purchasePriceYen,
      packageQuantity,
      packageUnit: unit,
      gramsEquivalent,
      isSalePrice: isSale,
      memo,
      source: "manual",
    });
    setName("");
    setPrice("");
    setQuantity("1");
    setUnit("kg");
    setGrams("");
    setMemo("");
    setIsSale(false);
    setMessage("価格を登録しました");
  }

  return (
    <div className="space-y-6">
      <Link href="/settings/store-budget" className="text-sm text-primary">
        ← 買い物先・予算へ
      </Link>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">食材価格</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          レシートや買い物時の価格を記録します（{settings.primaryStoreName}）
        </p>
      </header>

      <section className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-on-surface-variant">価格データ</p>
            <p className="text-lg font-bold">{stats.priceRecordCount}件</p>
          </div>
          <div>
            <p className="text-on-surface-variant">認識済み商品</p>
            <p className="text-lg font-bold">{stats.recognizedProductCount}種類</p>
          </div>
          <div>
            <p className="text-on-surface-variant">登録店舗</p>
            <p className="text-lg font-bold">{stats.registeredStoreCount}店</p>
          </div>
          <div>
            <p className="text-on-surface-variant">自動認識率</p>
            <p className="text-lg font-bold">
              {stats.autoMatchRate == null
                ? "—"
                : `${Math.round(stats.autoMatchRate * 100)}%`}
            </p>
          </div>
          <div>
            <p className="text-on-surface-variant">今月のレシート</p>
            <p className="text-lg font-bold">{stats.receiptsThisMonth}枚</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">
          使うほど価格予測と献立提案が正確になります
        </p>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="mt-2 text-xs font-medium text-primary"
        >
          {showHelp ? "説明を閉じる" : "？ 詳しく見る"}
        </button>
        {showHelp ? (
          <p className="mt-2 text-xs text-on-surface-variant">
            自動認識率は、過去マッピングで確認不要だった商品数 ÷
            全商品数です。レシート取込で店舗ごとの商品名と価格を学習します。
          </p>
        ) : null}
      </section>

      <Link
        href="/receipts/import"
        className="block rounded-2xl bg-primary px-4 py-3.5 text-center text-sm font-semibold text-on-primary"
      >
        レシートから価格を登録
      </Link>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant"
      >
        <label className="block space-y-1">
          <span className="text-sm">品名</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl bg-surface-container px-3 py-2.5"
            placeholder="豚こま"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm">購入金額（円）</span>
            <input
              type="number"
              min={1}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="w-full rounded-xl bg-surface-container px-3 py-2.5"
              placeholder="1200"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">数量</span>
            <input
              type="number"
              min={0.01}
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-full rounded-xl bg-surface-container px-3 py-2.5"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm">単位</span>
            <input
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              className="w-full rounded-xl bg-surface-container px-3 py-2.5"
              placeholder="kg"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">g換算（任意）</span>
            <input
              type="number"
              min={0}
              value={grams}
              onChange={(event) => setGrams(event.target.value)}
              className="w-full rounded-xl bg-surface-container px-3 py-2.5"
              placeholder="1000"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isSale}
            onChange={(event) => setIsSale(event.target.checked)}
          />
          特価
        </label>
        <label className="block space-y-1">
          <span className="text-sm">メモ</span>
          <input
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            className="w-full rounded-xl bg-surface-container px-3 py-2.5"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
        >
          登録
        </button>
      </form>

      {message ? (
        <p className="text-sm text-on-surface-variant">{message}</p>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">履歴</h2>
        {prices.length === 0 ? (
          <p className="rounded-2xl bg-surface-container px-4 py-6 text-center text-sm text-on-surface-variant">
            まだ価格がありません
          </p>
        ) : (
          <ul className="space-y-2">
            {prices.map((item) => {
              const analysis = analyzeIngredientPrice(
                item.ingredientName,
                prices,
                settings.primaryStoreName,
              );
              const buy = calculateBuyScore({
                ingredientName: item.ingredientName,
                priceRecords: prices,
                primaryStoreName: settings.primaryStoreName,
              });
              const phrase = shortAssessmentPhrase(analysis.priceAssessment);
              const expanded = expandedId === item.id;
              return (
              <li
                key={item.id}
                className="rounded-2xl bg-surface-container-lowest p-3 ring-1 ring-outline-variant"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      setExpandedId(expanded ? null : item.id)
                    }
                  >
                    <p className="font-semibold">{item.ingredientName}</p>
                    <p className="text-sm text-on-surface-variant">
                      {item.storeName}
                      {item.pricePer100g != null
                        ? ` ${formatYen(item.pricePer100g)} / 100g`
                        : ` ${formatYen(item.purchasePriceYen)}`}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      普段{" "}
                      {analysis.medianPrice90Days != null
                        ? `${formatYen(analysis.medianPrice90Days)} / 100g`
                        : "—"}
                      {phrase ? ` ・今は${phrase}` : ""}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      買い時 {"★".repeat(buy.stars)}
                      {"☆".repeat(Math.max(0, 5 - buy.stars))}
                    </p>
                    {analysis.sparseData ? (
                      <p className="text-xs text-on-surface-variant">
                        価格データがまだ少ないです
                      </p>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeIngredientPrice(item.id)}
                    className="shrink-0 text-sm text-error"
                  >
                    削除
                  </button>
                </div>
                {expanded ? (
                  <div className="mt-2 space-y-1 border-t border-outline-variant/40 pt-2 text-xs text-on-surface-variant">
                    <p>
                      30日中央値{" "}
                      {analysis.medianPrice30Days != null
                        ? formatYen(analysis.medianPrice30Days)
                        : "—"}
                      ／90日中央値{" "}
                      {analysis.medianPrice90Days != null
                        ? formatYen(analysis.medianPrice90Days)
                        : "—"}
                    </p>
                    <p>
                      最安{" "}
                      {analysis.lowestPrice90Days != null
                        ? formatYen(analysis.lowestPrice90Days)
                        : "—"}
                      ／最高{" "}
                      {analysis.highestPrice90Days != null
                        ? formatYen(analysis.highestPrice90Days)
                        : "—"}
                      ／登録{analysis.sampleCount}件
                    </p>
                    {analysis.byStore.length > 1 ? (
                      <ul className="space-y-0.5">
                        {analysis.byStore.map((store) => (
                          <li key={`${store.storeId}-${store.storeName}`}>
                            {store.storeName}{" "}
                            {store.latestPricePer100g != null
                              ? `${formatYen(store.latestPricePer100g)} / 100g`
                              : "—"}{" "}
                            {store.sampleCount}件
                            {store.sparseData ? "（参考少）" : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p>{buy.reasons.join("／")}</p>
                  </div>
                ) : null}
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
