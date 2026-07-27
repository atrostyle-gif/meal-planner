"use client";

import { useMemo, useState } from "react";
import { loadFamilyMemberProfiles } from "@/lib/family-member-profiles";
import { recordCookingWithFeedback } from "@/lib/recipe-learning/service";
import {
  IMPROVEMENT_TAGS,
  QUICK_IMPROVEMENT_TAG_IDS,
  type FamilyMemberRating,
  type RecipeAdjustment,
  type SeasoningAdjustment,
} from "@/types/recipe-learning";

type PostCookFeedbackPanelProps = {
  recipeId: string;
  householdId: string;
  defaultServings: number;
  defaultCookMinutes: number | null;
  onSaved?: () => void;
};

function StarPicker({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl leading-none ${
            value != null && star <= value
              ? "text-primary"
              : "text-outline-variant"
          }`}
          aria-label={`${star}点`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/** タグから構造化調整を起こす（履歴用） */
function buildAdjustmentsFromTags(tags: string[]): {
  adjustments: RecipeAdjustment[];
  seasoningAdjustments: SeasoningAdjustment[];
} {
  const adjustments: RecipeAdjustment[] = [];
  const seasoningAdjustments: SeasoningAdjustment[] = [];
  if (tags.includes("ing_onion_more") || tags.includes("ing_onion_add")) {
    adjustments.push({
      ingredientName: "玉ねぎ",
      adjustmentType: "increase",
      beforeValue: "1個",
      afterValue: "多め",
      memo: null,
    });
  }
  if (tags.includes("ing_veg_more")) {
    adjustments.push({
      ingredientName: "野菜",
      adjustmentType: "increase",
      beforeValue: null,
      afterValue: "増量",
      memo: null,
    });
  }
  if (tags.includes("ing_sesame_oil")) {
    adjustments.push({
      ingredientName: "ごま油",
      adjustmentType: "add",
      beforeValue: null,
      afterValue: "追加",
      memo: null,
    });
  }
  if (tags.includes("sweet_half_sugar")) {
    seasoningAdjustments.push({
      seasoning: "砂糖",
      beforeAmount: "大さじ2",
      afterAmount: "大さじ1",
      reason: "少し甘かった",
    });
  }
  return { adjustments, seasoningAdjustments };
}

/**
 * 食後フィードバック（30秒以内）。
 * 通常表示: ★ / 家族評価 / 今回変えたこと / メモ / 保存
 */
export function PostCookFeedbackPanel({
  recipeId,
  householdId,
  defaultServings,
  defaultCookMinutes,
  onSaved,
}: PostCookFeedbackPanelProps) {
  const members = useMemo(() => loadFamilyMemberProfiles(), []);
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [wantAgain, setWantAgain] = useState<boolean | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [memberRatings, setMemberRatings] = useState<Record<string, number>>(
    {},
  );
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const quickTags = IMPROVEMENT_TAGS.filter((tag) =>
    (QUICK_IMPROVEMENT_TAG_IDS as readonly string[]).includes(tag.id),
  );

  function toggleTag(id: string): void {
    setTags((current) =>
      current.includes(id)
        ? current.filter((tag) => tag !== id)
        : [...current, id],
    );
    if (id === "want_again" || id === "repeat_decide") {
      setWantAgain(true);
    }
  }

  function handlePhoto(file: File | null): void {
    if (!file) {
      setPhotoDataUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMessage("画像ファイルを選んでください");
      return;
    }
    // 端末容量配慮: 大きすぎる場合は保存しない（任意機能）
    if (file.size > 1_200_000) {
      setMessage("写真は約1MB以下にしてください（任意）");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      setPhotoDataUrl(typeof result === "string" ? result : null);
    };
    reader.readAsDataURL(file);
  }

  function handleSave(): void {
    const ratings: FamilyMemberRating[] = Object.entries(memberRatings)
      .filter(([, rating]) => rating >= 1)
      .map(([memberId, rating]) => ({
        memberId,
        memberName:
          members.find((m) => m.id === memberId)?.displayName ?? undefined,
        rating,
      }));
    const { adjustments, seasoningAdjustments } =
      buildAdjustmentsFromTags(tags);

    recordCookingWithFeedback({
      recipeId,
      householdId,
      createdBy: null,
      servings: defaultServings,
      cookingTimeActual: defaultCookMinutes,
      overallRating,
      wantAgain:
        wantAgain ??
        (tags.includes("want_again") || tags.includes("repeat_decide")
          ? true
          : null),
      improvementTags: tags,
      memo,
      memberRatings: ratings,
      adjustments,
      seasoningAdjustments,
      photoDataUrl,
    });
    setSaved(true);
    setMessage("保存しました");
    onSaved?.();
  }

  return (
    <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <StarPicker
        label="総合評価"
        value={overallRating}
        onChange={setOverallRating}
      />

      <div className="space-y-2">
        <p className="text-sm font-semibold">😊 家族の反応</p>
        {members.length === 0 ? (
          <p className="text-xs text-on-surface-variant">
            家族プロフィールを登録すると個別評価できます
          </p>
        ) : (
          <ul className="space-y-2">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-sm">{member.displayName}</span>
                <StarPicker
                  label={`${member.displayName}の評価`}
                  value={memberRatings[member.id] ?? null}
                  onChange={(n) =>
                    setMemberRatings((current) => ({
                      ...current,
                      [member.id]: n,
                    }))
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <hr className="border-outline-variant" />

      <div className="space-y-2">
        <p className="text-sm font-semibold">今回変えたこと</p>
        <div className="flex flex-wrap gap-2">
          {quickTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className={`rounded-xl px-3 py-2 text-sm ${
                tags.includes(tag.id)
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container ring-1 ring-outline-variant"
              }`}
            >
              {tags.includes(tag.id) ? "☑ " : ""}
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-outline-variant" />

      <label className="block space-y-1 text-sm">
        <span className="text-on-surface-variant">自由メモ</span>
        <textarea
          value={memo}
          maxLength={500}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          className="w-full rounded-xl bg-surface-container px-3 py-2"
          placeholder="任意"
        />
      </label>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-xs font-medium text-primary"
      >
        {showMore ? "▲ 閉じる" : "▼ 写真・ほかのタグ"}
      </button>

      {showMore ? (
        <div className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-on-surface-variant">完成写真（任意）</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
              className="block w-full text-xs"
            />
            {photoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoDataUrl}
                alt="完成写真プレビュー"
                className="mt-2 max-h-40 rounded-xl object-cover"
              />
            ) : null}
          </label>
          <div className="flex flex-wrap gap-2">
            {IMPROVEMENT_TAGS.filter(
              (tag) =>
                !(QUICK_IMPROVEMENT_TAG_IDS as readonly string[]).includes(
                  tag.id,
                ),
            ).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs ${
                  tags.includes(tag.id)
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container"
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWantAgain(true)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm ${
                wantAgain === true
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container"
              }`}
            >
              また作る
            </button>
            <button
              type="button"
              onClick={() => setWantAgain(false)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm ${
                wantAgain === false
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container"
              }`}
            >
              今回はパス
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={saved}
        className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary disabled:opacity-60"
      >
        {saved ? "保存済み" : "保存"}
      </button>
      {message ? (
        <p className="text-sm text-on-surface-variant" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
