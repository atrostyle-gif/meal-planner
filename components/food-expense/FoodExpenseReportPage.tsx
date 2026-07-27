"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  deleteManualExpense,
  deleteReceiptCascade,
  previewManualExpenseDeleteImpact,
  previewReceiptDeleteImpact,
} from "@/lib/food-expense/cascade";
import {
  getFoodExpensesServerSnapshot,
  getFoodExpensesSnapshot,
  subscribeFoodExpenses,
} from "@/lib/food-expense/repository";
import { buildFoodExpenseReport } from "@/lib/food-expense/report";
import { useFoodBudgetSettings } from "@/lib/use-food-budget";
import { useIsClient } from "@/lib/use-is-client";

type TabKey = "store" | "category" | "history";

function yen(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

export function FoodExpenseReportPage() {
  const isClient = useIsClient();
  const settings = useFoodBudgetSettings();
  const transactions = useSyncExternalStore(
    subscribeFoodExpenses,
    getFoodExpensesSnapshot,
    getFoodExpensesServerSnapshot,
  );
  const [tab, setTab] = useState<TabKey>("store");
  const [storeMode, setStoreMode] = useState<"branch" | "brand">("branch");
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "receipt" | "manual";
    id: string;
    summary: string;
  } | null>(null);

  const report = useMemo(
    () => buildFoodExpenseReport(new Date(), settings, transactions),
    [settings, transactions],
  );

  if (!isClient) {
    return <p className="text-sm text-on-surface-variant">読み込み中…</p>;
  }

  const remaining = report.remainingBudgetYen;
  const storeRows = storeMode === "brand" ? report.byBrand : report.byStore;

  function requestDelete(txId: string, receiptId: string | null): void {
    if (receiptId) {
      const impact = previewReceiptDeleteImpact(receiptId);
      if (!impact) return;
      setDeleteTarget({
        kind: "receipt",
        id: receiptId,
        summary: `${impact.storeName} ${impact.totalAmountYen != null ? yen(impact.totalAmountYen) : ""} / 明細${impact.receiptItemCount}・価格${impact.priceRecordCount}・家計簿1`,
      });
      return;
    }
    const impact = previewManualExpenseDeleteImpact(txId);
    if (!impact) return;
    setDeleteTarget({
      kind: "manual",
      id: txId,
      summary: `${impact.storeName} ${yen(impact.totalAmountYen)}（手動）`,
    });
  }

  function confirmDelete(): void {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "receipt") {
      deleteReceiptCascade(deleteTarget.id);
    } else {
      deleteManualExpense(deleteTarget.id);
    }
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">食費レポート</h1>
        <Link
          href="/food-expenses/add"
          className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary"
        >
          支出を追加
        </Link>
      </header>

      <section className="rounded-2xl bg-surface-container-lowest p-5 ring-1 ring-outline-variant">
        <p className="text-sm text-on-surface-variant">{report.monthLabel}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">
          {yen(report.actualPurchaseAmount)}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-on-surface-variant">月間予算</dt>
            <dd className="mt-0.5 text-lg font-semibold">
              {report.monthlyBudgetYen != null
                ? yen(report.monthlyBudgetYen)
                : "未設定"}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">残り</dt>
            <dd
              className={`mt-0.5 text-lg font-semibold ${
                remaining != null && remaining < 0 ? "text-error" : ""
              }`}
            >
              {remaining != null ? yen(remaining) : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex gap-2">
        {(
          [
            ["store", "店舗別"],
            ["category", "カテゴリ別"],
            ["history", "履歴"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-xl px-2 py-2.5 text-sm font-semibold ${
              tab === key
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-surface-container text-on-surface-variant"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "store" ? (
        <section className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStoreMode("branch")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                storeMode === "branch"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container"
              }`}
            >
              支店別
            </button>
            <button
              type="button"
              onClick={() => setStoreMode("brand")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                storeMode === "brand"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container"
              }`}
            >
              ブランド別
            </button>
          </div>
          {storeRows.length === 0 ? (
            <p className="text-sm text-on-surface-variant">まだ支出がありません</p>
          ) : (
            <ul className="space-y-2">
              {storeRows.map((row) => (
                <li
                  key={`${row.storeId ?? ""}-${row.storeName}`}
                  className="flex items-center justify-between rounded-xl bg-surface-container-lowest px-3 py-2.5 ring-1 ring-outline-variant"
                >
                  <span className="truncate font-medium">{row.storeName}</span>
                  <span className="shrink-0 text-sm">
                    {yen(row.amountYen)}
                    <span className="ml-2 text-on-surface-variant">
                      {row.percent}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "category" ? (
        <section>
          {report.byCategory.length === 0 ? (
            <p className="text-sm text-on-surface-variant">まだ支出がありません</p>
          ) : (
            <ul className="space-y-2">
              {report.byCategory.map((row) => (
                <li
                  key={row.category}
                  className="flex items-center justify-between rounded-xl bg-surface-container-lowest px-3 py-2.5 ring-1 ring-outline-variant"
                >
                  <span className="font-medium">{row.label}</span>
                  <span className="text-sm">{yen(row.amountYen)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "history" ? (
        <section className="space-y-2">
          {report.transactions.length === 0 ? (
            <p className="text-sm text-on-surface-variant">履歴がありません</p>
          ) : (
            <ul className="space-y-2">
              {report.transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="rounded-xl bg-surface-container-lowest px-3 py-2.5 ring-1 ring-outline-variant"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{tx.storeName}</p>
                      <p className="text-xs text-on-surface-variant">
                        {tx.purchasedAt.slice(0, 10)}
                        {tx.source === "manual" ? "・手動" : "・レシート"}
                        {tx.detailCompleteness === "amount_only"
                          ? "・金額のみ"
                          : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold">{yen(tx.totalAmountYen)}</p>
                      <button
                        type="button"
                        onClick={() => requestDelete(tx.id, tx.receiptId)}
                        className="mt-1 text-xs text-error"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setDetailOpen((v) => !v)}
        className="w-full rounded-xl bg-surface-container px-3 py-2.5 text-sm font-medium"
      >
        {detailOpen ? "詳細を閉じる" : "詳細を見る"}
      </button>

      {detailOpen ? (
        <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-on-surface-variant">今週</p>
              <p className="font-semibold">{yen(report.weekSpendYen)}</p>
            </div>
            <div>
              <p className="text-on-surface-variant">前月比</p>
              <p className="font-semibold">
                {report.monthOverMonthPercent == null
                  ? "—"
                  : `${report.monthOverMonthPercent > 0 ? "+" : ""}${Math.round(report.monthOverMonthPercent)}%`}
              </p>
            </div>
            <div>
              <p className="text-on-surface-variant">月の経過</p>
              <p className="font-semibold">{report.monthElapsedPercent}%</p>
            </div>
            <div>
              <p className="text-on-surface-variant">予算使用</p>
              <p className="font-semibold">
                {report.budgetUsedPercent != null
                  ? `${report.budgetUsedPercent}%`
                  : "—"}
              </p>
            </div>
          </div>

          {report.projectedMonthEndYen != null && !report.projectionSparse ? (
            <p className="text-sm text-on-surface-variant">
              今のペースでは月末に約{yen(report.projectedMonthEndYen)}の見込み
            </p>
          ) : (
            <p className="text-sm text-on-surface-variant">
              データが少ないため月末予測はまだ出しません
            </p>
          )}

          <div className="text-sm">
            <p className="font-medium">価格分析のカバー率</p>
            <p className="mt-1 text-on-surface-variant">
              {report.detailCoverage.priceAnalysisCoveragePercent}%（明細あり{" "}
              {report.detailCoverage.fullCount + report.detailCoverage.partialCount}
              ／金額のみ {report.detailCoverage.amountOnlyCount}）
            </p>
          </div>

          {report.inventoryValue.fridgeYen != null ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">在庫価値（参考）</p>
              <p>冷蔵庫など概算 {yen(report.inventoryValue.fridgeYen)}</p>
              {report.inventoryValue.purchasedUnusedYen != null ? (
                <p>
                  うち在庫として残っている概算{" "}
                  {yen(report.inventoryValue.purchasedUnusedYen)}
                </p>
              ) : null}
              {report.inventoryValue.estimatedConsumedYen != null ? (
                <p>
                  実際に消費した概算{" "}
                  {yen(report.inventoryValue.estimatedConsumedYen)}
                </p>
              ) : null}
              <p className="text-on-surface-variant">
                カバー率 {report.inventoryValue.coveragePercent}%
              </p>
            </div>
          ) : null}

          {report.byWeek.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium">週別</p>
              <ul className="space-y-1 text-sm">
                {report.byWeek.map((row) => (
                  <li key={row.weekStart} className="flex justify-between">
                    <span>{row.weekStart}〜</span>
                    <span>{yen(row.amountYen)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex justify-center gap-4 text-sm">
        <Link href="/receipts/import" className="text-primary">
          🏪 レシート
        </Link>
        <Link href="/settings/store-budget" className="text-on-surface-variant">
          予算設定
        </Link>
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-2xl bg-surface p-4">
            <p className="font-semibold">削除しますか？</p>
            <p className="text-sm text-on-surface-variant">
              影響: {deleteTarget.summary}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl bg-surface-container px-3 py-2.5 text-sm font-semibold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-error px-3 py-2.5 text-sm font-semibold text-on-primary"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
