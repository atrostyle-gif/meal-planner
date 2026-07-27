"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getWeekStart } from "@/lib/date";
import {
  saveFoodBudgetSettings,
} from "@/lib/food-budget/settings";
import {
  ensurePrimaryStoreByName,
  getStoreRepository,
  subscribeStores,
  getStoresSnapshot,
  getStoresServerSnapshot,
} from "@/lib/stores/store-repository";
import { useFoodBudgetSettings } from "@/lib/use-food-budget";
import { useSyncExternalStore } from "react";
import {
  BUDGET_MODE_LABELS,
  BUDGET_MODES,
  type BudgetMode,
} from "@/types/food-budget";
import { STORE_TYPE_LABELS, type StoreType } from "@/types/store";

export function StoreBudgetSettingsPage() {
  const settings = useFoodBudgetSettings();
  const stores = useSyncExternalStore(
    subscribeStores,
    getStoresSnapshot,
    getStoresServerSnapshot,
  );
  const repo = getStoreRepository();
  const weekStart = getWeekStart();
  const weekPlan = useMemo(() => {
    void stores.length;
    return repo.getWeekPlan(weekStart);
  }, [weekStart, stores, repo]);

  const [storeName, setStoreName] = useState("");
  const [budgetYen, setBudgetYen] = useState(
    settings.weeklyFoodBudgetYen?.toString() ?? "",
  );
  const [monthlyBudgetYen, setMonthlyBudgetYen] = useState(
    settings.monthlyFoodBudgetYen?.toString() ?? "",
  );
  const [monthlyStartDay, setMonthlyStartDay] = useState(
    String(settings.monthlyBudgetStartDay),
  );
  const [includePreparedFood, setIncludePreparedFood] = useState(
    settings.includePreparedFood,
  );
  const [includeEatingOut, setIncludeEatingOut] = useState(
    settings.includeEatingOut,
  );
  const [includeHouseholdGoods, setIncludeHouseholdGoods] = useState(
    settings.includeHouseholdGoods,
  );
  const [budgetMode, setBudgetMode] = useState<BudgetMode>(settings.budgetMode);
  const [message, setMessage] = useState<string | null>(null);
  const [weights, setWeights] = useState(settings.scoreWeights);
  const [allowMulti, setAllowMulti] = useState(weekPlan.allowMultiStoreShopping);
  const [maxVisits, setMaxVisits] = useState(String(weekPlan.maxStoreVisits));

  function handleAddStore(): void {
    if (!storeName.trim()) {
      setMessage("店名を入力してください");
      return;
    }
    repo.upsert({
      name: storeName.trim(),
      isPrimary: stores.length === 0,
      prefersBulkPurchase: /ロピア|業務スーパー|コストコ/.test(storeName),
      storeType: "supermarket",
      storeBrandName: storeName.trim(),
    });
    setStoreName("");
    setMessage("店舗を追加しました");
  }

  function handleSeedLopia(): void {
    const store = ensurePrimaryStoreByName("ロピア");
    saveFoodBudgetSettings({ primaryStoreName: store.name });
    setMessage("ロピアを主な買い物先に設定しました");
  }

  function handleSaveBudget(): void {
    const yen = budgetYen.trim() === "" ? null : Number(budgetYen);
    if (yen !== null && (!Number.isFinite(yen) || yen < 0)) {
      setMessage("週間予算は0以上の数字で入力してください");
      return;
    }
    const monthly =
      monthlyBudgetYen.trim() === "" ? null : Number(monthlyBudgetYen);
    if (monthly !== null && (!Number.isFinite(monthly) || monthly < 0)) {
      setMessage("月間予算は0以上の数字で入力してください");
      return;
    }
    const startDay = Number(monthlyStartDay);
    if (!Number.isInteger(startDay) || startDay < 1 || startDay > 28) {
      setMessage("月の開始日は1〜28で入力してください");
      return;
    }
    const primary = stores.find((s) => s.isPrimary);
    saveFoodBudgetSettings({
      primaryStoreName: primary?.name ?? settings.primaryStoreName,
      weeklyFoodBudgetYen: yen,
      monthlyFoodBudgetYen: monthly,
      monthlyBudgetStartDay: startDay,
      includePreparedFood,
      includeEatingOut,
      includeHouseholdGoods,
      budgetMode,
      scoreWeights: weights,
    });
    repo.saveWeekPlan({
      ...weekPlan,
      allowMultiStoreShopping: allowMulti,
      maxStoreVisits: Math.max(1, Number(maxVisits) || 1),
    });
    setMessage("保存しました");
  }

  return (
    <div className="space-y-6">
      <Link href="/settings" className="text-sm text-primary">
        ← 設定へ
      </Link>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">🏪 買い物先・予算</h1>
      </header>

      <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-lg font-semibold">登録店舗</h2>
        {stores.length === 0 ? (
          <p className="text-sm text-on-surface-variant">まだ店舗がありません</p>
        ) : (
          <ul className="space-y-2">
            {stores.map((store) => (
              <li
                key={store.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-surface-container px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {store.name}
                    {store.isPrimary ? (
                      <span className="ml-2 text-xs text-primary">主な店</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {STORE_TYPE_LABELS[store.storeType as StoreType]}
                    {store.prefersBulkPurchase ? "・大容量向き" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!store.isPrimary ? (
                    <button
                      type="button"
                      className="text-xs text-primary"
                      onClick={() => {
                        repo.setPrimary(store.id);
                        saveFoodBudgetSettings({ primaryStoreName: store.name });
                      }}
                    >
                      主な店に
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-xs text-error"
                    onClick={() => repo.remove(store.id)}
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            className="min-w-0 flex-1 rounded-xl bg-surface-container px-3 py-2.5"
            placeholder="新しい店名"
          />
          <button
            type="button"
            onClick={handleAddStore}
            className="shrink-0 rounded-xl bg-secondary-container px-3 py-2 text-sm font-semibold"
          >
            追加
          </button>
        </div>
        <button
          type="button"
          onClick={handleSeedLopia}
          className="rounded-xl px-3 py-2 text-sm font-medium text-primary ring-1 ring-primary/30"
        >
          ロピアを主な買い物先にする
        </button>
      </section>

      <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-lg font-semibold">今週行く予定の店</h2>
        <ul className="space-y-2">
          {stores.map((store) => {
            const checked = weekPlan.plannedStoreIds.includes(store.id);
            return (
              <label key={store.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const nextIds = checked
                      ? weekPlan.plannedStoreIds.filter((id) => id !== store.id)
                      : [...weekPlan.plannedStoreIds, store.id];
                    repo.saveWeekPlan({
                      ...weekPlan,
                      plannedStoreIds: nextIds,
                      primaryPlannedStoreId:
                        weekPlan.primaryPlannedStoreId &&
                        nextIds.includes(weekPlan.primaryPlannedStoreId)
                          ? weekPlan.primaryPlannedStoreId
                          : (nextIds[0] ?? null),
                    });
                  }}
                />
                {store.name}
              </label>
            );
          })}
        </ul>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowMulti}
            onChange={(event) => setAllowMulti(event.target.checked)}
          />
          複数店舗を許可
        </label>
        <label className="block space-y-1 text-sm">
          <span>最大店舗数</span>
          <input
            type="number"
            min={1}
            value={maxVisits}
            onChange={(event) => setMaxVisits(event.target.value)}
            className="w-24 rounded-xl bg-surface-container px-3 py-2"
          />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-lg font-semibold">週間食費予算（献立向け）</h2>
        <label className="block space-y-1">
          <span className="text-sm text-on-surface-variant">予算（円）</span>
          <input
            type="number"
            min={0}
            value={budgetYen}
            onChange={(event) => setBudgetYen(event.target.value)}
            className="w-full rounded-xl bg-surface-container px-3 py-2.5"
            placeholder="7000"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-on-surface-variant">予算の見方</span>
          <select
            value={budgetMode}
            onChange={(event) =>
              setBudgetMode(event.target.value as BudgetMode)
            }
            className="w-full rounded-xl bg-surface-container px-3 py-2.5"
          >
            {BUDGET_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {BUDGET_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-lg font-semibold">月間食費予算（家計簿向け）</h2>
        <label className="block space-y-1">
          <span className="text-sm text-on-surface-variant">月間予算（円）</span>
          <input
            type="number"
            min={0}
            value={monthlyBudgetYen}
            onChange={(event) => setMonthlyBudgetYen(event.target.value)}
            className="w-full rounded-xl bg-surface-container px-3 py-2.5"
            placeholder="40000"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-on-surface-variant">月の開始日</span>
          <input
            type="number"
            min={1}
            max={28}
            value={monthlyStartDay}
            onChange={(event) => setMonthlyStartDay(event.target.value)}
            className="w-24 rounded-xl bg-surface-container px-3 py-2.5"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includePreparedFood}
            onChange={(event) => setIncludePreparedFood(event.target.checked)}
          />
          惣菜・加工を食費に含める
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeEatingOut}
            onChange={(event) => setIncludeEatingOut(event.target.checked)}
          />
          外食・テイクアウトを食費に含める
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeHouseholdGoods}
            onChange={(event) => setIncludeHouseholdGoods(event.target.checked)}
          />
          日用品を食費に含める
        </label>
        <Link href="/food-expenses" className="block text-sm text-primary">
          食費レポートを見る
        </Link>
      </section>

      <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
        <h2 className="text-lg font-semibold">自動編成の重み</h2>
        {(
          [
            ["budget", "予算"],
            ["bulkUsage", "大容量使い回し"],
            ["fridge", "在庫活用"],
            ["health", "健康・体重管理"],
            ["variety", "バラエティ"],
            ["time", "時間"],
            ["perishable", "傷みやすさ"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-3">
            <span className="text-sm">{label}</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={weights[key]}
              onChange={(event) =>
                setWeights((current) => ({
                  ...current,
                  [key]: Number(event.target.value) || 0,
                }))
              }
              className="w-24 rounded-xl bg-surface-container px-3 py-2 text-right"
            />
          </label>
        ))}
      </section>

      <button
        type="button"
        onClick={handleSaveBudget}
        className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
      >
        保存
      </button>
      {message ? (
        <p className="text-sm text-on-surface-variant">{message}</p>
      ) : null}

      <Link
        href="/receipts/import"
        className="block rounded-2xl bg-secondary-container px-4 py-3 text-center text-sm font-semibold text-on-secondary-container"
      >
        レシートから価格を登録
      </Link>
      <Link
        href="/settings/ingredient-prices"
        className="block text-center text-sm text-primary"
      >
        食材価格へ
      </Link>
    </div>
  );
}
