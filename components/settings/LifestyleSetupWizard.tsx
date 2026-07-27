"use client";

import Link from "next/link";
import { useState } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import { loadFamilyMemberProfiles } from "@/lib/family-member-profiles";
import { applyFamilyWeeklyPreset } from "@/lib/weekly-cooking-schedules";

const steps = [
  [
    "家族プロフィール",
    "献立を食べる家族を登録します。",
    "/settings/family-profiles?section=members",
  ],
  [
    "調理する人",
    "料理を作る人ごとの得意・苦手を設定します。",
    "/settings/cooking-members",
  ],
  [
    "週間スケジュール",
    "曜日ごとの担当者と時間の目安を決めます。",
    "/settings/weekly-schedule",
  ],
  [
    "レシピの作りやすさ",
    "担当者や工程数などをレシピに追加できます。",
    "/recipes",
  ],
  [
    "今日だけの予定",
    "外食や忙しい日は献立画面から変更できます。",
    "/meals",
  ],
  [
    "献立を提案",
    "生活スタイルに合わせた献立の準備ができました。",
    "/meals",
  ],
] as const;

type LifestyleSetupWizardProps = {
  /** 家族プロフィール内セクションとして埋め込む */
  embedded?: boolean;
};

export function LifestyleSetupWizard({
  embedded = false,
}: LifestyleSetupWizardProps) {
  const { household } = useFamilySession();
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [title, description, href] = steps[index];

  function preset(): void {
    const members = loadFamilyMemberProfiles();
    const find = (word: string, fallback: number): string | undefined =>
      members.find((member) => member.displayName.includes(word))?.id ??
      members[fallback]?.id;
    applyFamilyWeeklyPreset(household?.id ?? "local", {
      wife: find("妻", 0),
      husband: find("夫", 1),
      daughter: find("娘", 2),
    });
    setMessage("週間スケジュールのプリセットを適用しました");
  }

  return (
    <div className="space-y-4">
      {embedded ? (
        <header className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">生活スタイル</h2>
          <p className="text-sm text-on-surface-variant">
            あとからいつでも変更できます
          </p>
        </header>
      ) : (
        <header>
          <Link href="/settings" className="text-sm text-primary">
            ← 設定
          </Link>
          <h1 className="mt-2 text-2xl font-bold">生活スタイル設定</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            あとからいつでも変更できます。
          </p>
        </header>
      )}

      <div className="flex gap-1" aria-label={`手順 ${index + 1} / 6`}>
        {steps.map((_, itemIndex) => (
          <div
            key={itemIndex}
            className={`h-1 flex-1 rounded ${
              itemIndex <= index ? "bg-primary" : "bg-surface-container"
            }`}
          />
        ))}
      </div>

      <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-5 ring-1 ring-outline-variant">
        <p className="text-sm text-on-surface-variant">
          ステップ {index + 1} / 6
        </p>
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-sm text-on-surface-variant">{description}</p>
        {embedded && index === 0 ? (
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("members")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="inline-block rounded-xl bg-secondary-container px-4 py-2.5 text-sm font-semibold text-on-secondary-container"
          >
            上のメンバー設定へ
          </button>
        ) : (
          <Link
            href={href}
            className="inline-block rounded-xl bg-secondary-container px-4 py-2.5 text-sm font-semibold text-on-secondary-container"
          >
            設定を開く
          </Link>
        )}
      </section>

      {index === 2 ? (
        <button
          type="button"
          onClick={preset}
          className="w-full rounded-xl bg-secondary-container px-4 py-3 text-sm font-semibold text-on-secondary-container"
        >
          家族向けプリセットを適用
        </button>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((value) => value - 1)}
          className="flex-1 rounded-xl p-3 text-sm ring-1 ring-outline-variant disabled:opacity-40"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={() =>
            setIndex((value) => Math.min(steps.length - 1, value + 1))
          }
          className="flex-1 rounded-xl bg-primary p-3 text-sm font-semibold text-on-primary"
        >
          {index === steps.length - 1 ? "完了" : "次へ"}
        </button>
      </div>

      {!embedded ? (
        <Link
          href="/settings"
          className="block text-center text-sm text-primary"
        >
          あとで設定する
        </Link>
      ) : null}

      {message ? (
        <p role="status" className="text-sm text-on-surface-variant">
          {message}
        </p>
      ) : null}
    </div>
  );
}
