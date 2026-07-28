"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import {
  getFamilyLearningProfileServerSnapshot,
  getFamilyLearningProfileSnapshot,
  refreshFamilyLearningProfile,
  resetFamilyLearningOnly,
  subscribeFamilyLearningProfile,
} from "@/lib/family-learning/store";
import type { FamilyLearningProfile } from "@/types/family-learning";

function useLearningProfile(): FamilyLearningProfile {
  return useSyncExternalStore(
    subscribeFamilyLearningProfile,
    getFamilyLearningProfileSnapshot,
    getFamilyLearningProfileServerSnapshot,
  );
}

function ReportCard({
  title,
  children,
  emptyText,
}: {
  title: string;
  children: ReactNode;
  emptyText?: string;
}) {
  const isEmpty = children == null || children === false;
  return (
    <section className="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="mt-3">
        {isEmpty ? (
          <p className="text-sm text-on-surface-variant">
            {emptyText ?? "まだデータがありません"}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/**
 * AI分析レポート（閲覧専用。設定変更は学習リセットのみ）。
 */
export function AiLearningReportPage() {
  const { household } = useFamilySession();
  const householdId = household?.id ?? "local";
  const profile = useLearningProfile();
  const [message, setMessage] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);

  const insights = useMemo(() => {
    if (profile.insights.length > 0) return profile.insights;
    if (profile.sampleCount === 0) {
      return [] as string[];
    }
    return ["データはありますが、まだ明確な傾向が出ていません。"];
  }, [profile]);

  const improvements = useMemo(() => {
    const items: string[] = [];
    for (const avoided of profile.avoidedPatterns) {
      items.push(`${avoided.label}は${avoided.reason}ので控えめに`);
    }
    if (profile.tasteThickRate != null && profile.tasteThickRate >= 0.35) {
      items.push("味を少し薄めにする調整を試す");
    }
    if (profile.tasteThinRate != null && profile.tasteThinRate >= 0.35) {
      items.push("味付けを少ししっかりめにする");
    }
    if (insights.some((i) => i.includes("野菜"))) {
      items.push("副菜や野菜多めの献立を増やす");
    }
    if (insights.some((i) => i.includes("洋食が多め"))) {
      items.push("和食や魚料理を週に混ぜる");
    }
    for (const member of profile.memberLearning) {
      if (member.preferEasy) {
        items.push(`${member.memberName}担当日は20〜25分以内を中心に`);
      }
    }
    return [...new Set(items)].slice(0, 6);
  }, [profile, insights]);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p>
          <Link href="/data" className="text-sm text-primary">
            ← データ
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">AI分析</h1>
        <p className="text-sm text-on-surface-variant">
          この家庭の学習結果レポートです
        </p>
      </header>

      <ReportCard
        title="最近分かったこと"
        emptyText="まだ学習データがありません。調理後レビューを続けると傾向が分かります。"
      >
        {insights.length > 0 ? (
          <ul className="space-y-2 text-sm text-on-surface-variant">
            {insights.map((line) => (
              <li key={line} className="rounded-xl bg-surface-container px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </ReportCard>

      <ReportCard title="担当者傾向">
        {profile.memberLearning.length > 0 ? (
          <ul className="space-y-2">
            {profile.memberLearning.map((member) => (
              <li
                key={member.memberId}
                className="rounded-xl bg-surface-container px-3 py-2.5"
              >
                <p className="text-sm font-semibold">{member.memberName}</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {member.insight ??
                    `調理${member.cookCount}回${
                      member.averageRating != null
                        ? ` · 平均★${member.averageRating}`
                        : ""
                    }`}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </ReportCard>

      <ReportCard title="成功パターン">
        {profile.successfulPatterns.length > 0 ||
        profile.favoriteCuisine.length > 0 ? (
          <ul className="space-y-2">
            {profile.successfulPatterns.slice(0, 6).map((pattern) => (
              <li
                key={pattern.id}
                className="rounded-xl bg-surface-container px-3 py-2 text-sm text-on-surface-variant"
              >
                {pattern.label}
              </li>
            ))}
            {profile.favoriteCuisine.slice(0, 3).map((c) => (
              <li
                key={`c-${c.name}`}
                className="rounded-xl bg-surface-container px-3 py-2 text-sm text-on-surface-variant"
              >
                {c.name}は評価★{c.avgRating}（{c.count}件）
              </li>
            ))}
          </ul>
        ) : null}
      </ReportCard>

      <ReportCard title="改善提案">
        {improvements.length > 0 ? (
          <ul className="space-y-2">
            {improvements.map((line) => (
              <li
                key={line}
                className="rounded-xl bg-surface-container px-3 py-2 text-sm text-on-surface-variant"
              >
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">
            十分なデータが集まると提案が出ます
          </p>
        )}
      </ReportCard>

      <p className="text-xs text-on-surface-variant">
        学習サンプル: {profile.sampleCount}件
        {profile.updatedAt
          ? ` · 更新 ${new Date(profile.updatedAt).toLocaleString("ja-JP")}`
          : ""}
      </p>

      <button
        type="button"
        onClick={() => setShowActions((v) => !v)}
        className="w-full rounded-xl bg-surface-container px-3 py-2.5 text-sm font-medium text-on-surface-variant"
      >
        {showActions ? "▲ 学習操作を閉じる" : "▼ 学習の再計算・リセット"}
      </button>

      {showActions ? (
        <section className="space-y-2 rounded-2xl bg-surface-container p-4">
          <button
            type="button"
            onClick={() => {
              refreshFamilyLearningProfile(householdId);
              setMessage("学習を再計算しました");
            }}
            className="w-full rounded-xl bg-secondary-container px-3 py-2.5 text-sm font-semibold text-on-secondary-container"
          >
            いま再計算する
          </button>
          <button
            type="button"
            onClick={() => {
              const ok = window.confirm(
                "AI学習だけリセットします。レビューや家族プロフィールは消えません。よろしいですか？",
              );
              if (!ok) return;
              resetFamilyLearningOnly(householdId);
              setMessage("AI学習をリセットしました");
            }}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-medium text-error ring-1 ring-error/30"
          >
            AI学習だけリセット
          </button>
          {message ? (
            <p className="text-sm text-on-surface-variant" role="status">
              {message}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
