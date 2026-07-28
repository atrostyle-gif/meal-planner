"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function ReceiptDonePage() {
  const params = useSearchParams();
  const count = params.get("count") ?? "0";
  const checked = params.get("checked") ?? "0";
  const checkedNum = Number(checked);

  return (
    <div className="space-y-6 py-8 text-center">
      <p className="text-sm text-on-surface-variant">手順 3 / 3</p>
      <h1 className="text-2xl font-bold">登録完了</h1>
      <p className="text-on-surface-variant">
        価格履歴に {count} 件を追加しました
      </p>
      {checkedNum > 0 ? (
        <p className="text-sm text-on-surface-variant">
          買い物リストの {checkedNum} 件を購入済みにしました
        </p>
      ) : null}
      <p className="text-sm text-on-surface-variant">
        使うほど価格予測と献立提案が正確になります
      </p>
      <div className="flex flex-col gap-2">
        <Link
          href="/shopping"
          className="rounded-2xl bg-primary px-4 py-3 font-semibold text-on-primary"
        >
          買い物リストへ
        </Link>
        <Link
          href="/settings/ingredient-prices"
          className="rounded-2xl bg-secondary-container px-4 py-3 font-semibold text-on-secondary-container"
        >
          価格履歴を見る
        </Link>
        <Link href="/receipts/import" className="text-sm text-primary">
          別のレシートを取り込む
        </Link>
      </div>
    </div>
  );
}
