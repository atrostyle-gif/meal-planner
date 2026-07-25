"use client";

import { useMemo, useRef, useState } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import {
  countPushSuccess,
  getLocalMigrationPreview,
  type PushResult,
} from "@/lib/sync/cloud-sync";

type ResultView = {
  kind: "success" | "partial" | "failure";
  title: string;
  lines: string[];
};

function buildResultView(result: PushResult | null): ResultView {
  if (!result) {
    return {
      kind: "failure",
      title: "家族共有へのコピーに失敗しました",
      lines: ["設定画面からあとで再試行できます。"],
    };
  }

  const successTotal = countPushSuccess(result);
  const failCount = result.errors.length;
  const lines = [
    `レシピ ${result.recipes}件`,
    `週間献立 ${result.mealPlans}件`,
    `買い物リスト ${result.shoppingLists}件`,
    `冷蔵庫の在庫 ${result.inventory}件`,
    `常備品の状態 ${result.pantry}件`,
  ];

  if (failCount === 0) {
    return {
      kind: "success",
      title: `家族共有へコピーしました（合計 ${successTotal}件）`,
      lines,
    };
  }

  if (successTotal === 0) {
    return {
      kind: "failure",
      title: `コピーに失敗しました（失敗 ${failCount}件）`,
      lines: [...lines, ...result.errors.slice(0, 3)],
    };
  }

  return {
    kind: "partial",
    title: `一部コピーできました（成功 ${successTotal}件 / 失敗 ${failCount}件）`,
    lines: [...lines, ...result.errors.slice(0, 3)],
  };
}

export function MigrationPrompt() {
  const {
    needsMigrationPrompt,
    dismissMigrationPrompt,
    migrateLocalToCloud,
    syncing,
    household,
  } = useFamilySession();
  const [resultView, setResultView] = useState<ResultView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const preview = useMemo(() => {
    if (!needsMigrationPrompt) {
      return null;
    }
    return getLocalMigrationPreview();
  }, [needsMigrationPrompt]);

  if (!needsMigrationPrompt && !resultView) {
    return null;
  }

  const busy = syncing || submitting;
  const householdName = household?.name?.trim() ?? "";

  if (resultView) {
    const tone =
      resultView.kind === "success"
        ? "bg-secondary-container text-on-secondary-container"
        : resultView.kind === "partial"
          ? "bg-surface-container-lowest text-on-surface ring-1 ring-outline-variant"
          : "bg-error-container text-error";

    return (
      <div className={`mb-4 rounded-2xl px-4 py-3 text-sm ${tone}`}>
        <p className="font-medium">{resultView.title}</p>
        <ul className="mt-2 space-y-0.5 text-xs opacity-90">
          {resultView.lines.map((line) => (
            <li key={line}>・{line}</li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-2 text-sm font-medium underline"
          onClick={() => setResultView(null)}
        >
          閉じる
        </button>
      </div>
    );
  }

  async function handleCopy(): Promise<void> {
    if (submittingRef.current || busy) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await migrateLocalToCloud();
      dismissMigrationPrompt();
      setResultView(buildResultView(result));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <h2 className="text-base font-semibold text-on-surface">
        この端末のデータを家族で共有しますか？
      </h2>

      <p className="mt-2 text-sm text-on-surface">
        この端末だけに保存されているデータを、現在の家庭の共有スペースへコピーします。
        コピーすると、家族が別のスマートフォンやPCから同じ内容を見たり編集したりできます。
      </p>

      {householdName !== "" ? (
        <p className="mt-2 text-sm font-medium text-primary">
          「{householdName}」の共有スペースへコピーします
        </p>
      ) : null}

      <div className="mt-3 space-y-1">
        <p className="text-xs font-medium text-on-surface-variant">
          コピーするもの
        </p>
        <ul className="space-y-0.5 text-sm text-on-surface">
          <li>
            ・レシピ
            {preview && preview.recipes > 0 ? ` ${preview.recipes}件` : ""}
          </li>
          <li>
            ・週間献立
            {preview && preview.mealPlanDays > 0
              ? ` ${preview.mealPlanDays}日分`
              : preview && preview.mealPlans > 0
                ? ` ${preview.mealPlans}週分`
                : ""}
          </li>
          <li>
            ・買い物リスト
            {preview && preview.shoppingLists > 0
              ? ` ${preview.shoppingLists}件`
              : ""}
          </li>
          <li>
            ・冷蔵庫の在庫
            {preview && preview.inventory > 0 ? ` ${preview.inventory}件` : ""}
          </li>
          <li>
            ・常備品の状態
            {preview && preview.pantry > 0 ? ` ${preview.pantry}件` : ""}
          </li>
        </ul>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-xs font-medium text-on-surface-variant">注意</p>
        <ul className="space-y-0.5 text-xs text-on-surface-variant">
          <li>・この端末にある元データは削除されません</li>
          <li>・同じデータの重複登録をできるだけ防ぎます</li>
          <li>・コピーはあとから設定画面でも実行できます</li>
        </ul>
      </div>

      {busy ? (
        <p className="mt-3 text-sm font-medium text-primary" role="status">
          家族共有へコピー中…
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            dismissMigrationPrompt();
          }}
          className="flex-1 rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface-variant disabled:opacity-60"
        >
          あとで移行する
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void handleCopy();
          }}
          className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
        >
          {busy ? "コピー中…" : "家族共有へコピー"}
        </button>
      </div>
    </div>
  );
}
