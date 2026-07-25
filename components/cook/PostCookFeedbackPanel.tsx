"use client";

import { useMemo, useState } from "react";
import { recordCookingWithFeedback } from "@/lib/recipe-learning/service";
import { loadFamilyMemberProfiles } from "@/lib/family-member-profiles";
import {
  IMPROVEMENT_TAGS,
  type FamilyMemberRating,
  type TasteSaltLevel,
  type TasteSweetLevel,
  type TasteSpicyLevel,
  type TextureLevel,
  type TimeFeelingLevel,
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
}: {
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="総合評価">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl ${
            value != null && star <= value ? "text-primary" : "text-outline-variant"
          }`}
          aria-label={`${star}点`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-on-surface-variant">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-xl px-3 py-2 text-sm ${
              value === option.value
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  const [createdBy, setCreatedBy] = useState("");
  const [servings, setServings] = useState(defaultServings);
  const [cookingTimeActual, setCookingTimeActual] = useState(
    defaultCookMinutes ?? "",
  );
  const [tasteSalt, setTasteSalt] = useState<TasteSaltLevel | null>(null);
  const [tasteSweet, setTasteSweet] = useState<TasteSweetLevel | null>(null);
  const [tasteSpicy, setTasteSpicy] = useState<TasteSpicyLevel | null>(null);
  const [texture, setTexture] = useState<TextureLevel | null>(null);
  const [timeFeeling, setTimeFeeling] = useState<TimeFeelingLevel | null>(null);
  const [memberRatings, setMemberRatings] = useState<
    Record<string, number>
  >({});
  const [showDetail, setShowDetail] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggleTag(id: string): void {
    setTags((current) =>
      current.includes(id)
        ? current.filter((tag) => tag !== id)
        : [...current, id],
    );
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

    recordCookingWithFeedback({
      recipeId,
      householdId,
      createdBy: createdBy || null,
      servings,
      cookingTimeActual:
        typeof cookingTimeActual === "number"
          ? cookingTimeActual
          : cookingTimeActual === ""
            ? null
            : Number(cookingTimeActual),
      overallRating,
      wantAgain,
      improvementTags: tags,
      memo,
      memberRatings: ratings,
      tasteSalt,
      tasteSweet,
      tasteSpicy,
      texture,
      timeFeeling,
    });
    setSaved(true);
    setMessage("記録しました。我が家のノウハウに追加されます。");
    onSaved?.();
  }

  const quickTags = IMPROVEMENT_TAGS.filter((tag) =>
    ["taste_bit_thick", "ing_onion_add", "want_again", "other_easy", "kid_popular", "salt_reduce"].includes(
      tag.id,
    ),
  );

  return (
    <section className="space-y-4 rounded-2xl bg-secondary-container/40 p-4">
      <div>
        <h2 className="text-lg font-semibold">今回どうだった？（約30秒）</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          入力するほど、この家庭だけのレシピが育っていきます
        </p>
      </div>

      <StarPicker value={overallRating} onChange={setOverallRating} />

      <div className="flex flex-wrap gap-2">
        {quickTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.id)}
            className={`rounded-xl px-3 py-2 text-sm ${
              tags.includes(tag.id)
                ? "bg-primary text-on-primary"
                : "bg-surface-container-lowest ring-1 ring-outline-variant"
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
          className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium ${
            wantAgain === true
              ? "bg-primary text-on-primary"
              : "bg-surface-container"
          }`}
        >
          また作る Yes
        </button>
        <button
          type="button"
          onClick={() => setWantAgain(false)}
          className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium ${
            wantAgain === false
              ? "bg-primary text-on-primary"
              : "bg-surface-container"
          }`}
        >
          また作る No
        </button>
      </div>

      <label className="block space-y-1 text-sm">
        <span>メモ（最大500文字）</span>
        <textarea
          value={memo}
          maxLength={500}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          className="w-full rounded-xl bg-surface-container-lowest px-3 py-2"
          placeholder="例: 次は玉ねぎを多めに"
        />
      </label>

      <button
        type="button"
        onClick={() => setShowDetail((v) => !v)}
        className="text-xs font-medium text-primary"
      >
        {showDetail ? "詳細評価を閉じる" : "詳細評価・家族別評価を開く"}
      </button>

      {showDetail ? (
        <div className="space-y-4 rounded-xl bg-surface-container-lowest p-3">
          <label className="block text-sm">
            記録者
            <select
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              className="mt-1 w-full rounded-xl bg-surface-container p-3"
            >
              <option value="">未設定</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            人数
            <input
              type="number"
              min={1}
              max={12}
              value={servings}
              onChange={(e) => setServings(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-xl bg-surface-container px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            実際の調理時間（分）
            <input
              type="number"
              min={1}
              value={cookingTimeActual}
              onChange={(e) =>
                setCookingTimeActual(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              className="mt-1 w-full rounded-xl bg-surface-container px-3 py-2"
            />
          </label>

          <ChoiceRow
            label="味"
            value={tasteSalt}
            onChange={setTasteSalt}
            options={[
              { value: "thin", label: "薄い" },
              { value: "just", label: "ちょうどいい" },
              { value: "thick", label: "濃い" },
            ]}
          />
          <ChoiceRow
            label="甘さ"
            value={tasteSweet}
            onChange={setTasteSweet}
            options={[
              { value: "sweet", label: "甘い" },
              { value: "just", label: "ちょうど" },
              { value: "not_sweet", label: "甘くない" },
            ]}
          />
          <ChoiceRow
            label="辛さ"
            value={tasteSpicy}
            onChange={setTasteSpicy}
            options={[
              { value: "spicy", label: "辛い" },
              { value: "just", label: "ちょうど" },
              { value: "not_spicy", label: "辛くない" },
            ]}
          />
          <ChoiceRow
            label="食感"
            value={texture}
            onChange={setTexture}
            options={[
              { value: "soft", label: "柔らかい" },
              { value: "just", label: "ちょうど" },
              { value: "hard", label: "硬い" },
            ]}
          />
          <ChoiceRow
            label="調理時間"
            value={timeFeeling}
            onChange={setTimeFeeling}
            options={[
              { value: "long", label: "長かった" },
              { value: "just", label: "ちょうど" },
              { value: "short", label: "短かった" },
            ]}
          />

          <div className="space-y-2">
            <p className="text-sm font-medium">家族別評価</p>
            {members.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                家族プロフィールを登録すると個別評価できます
              </p>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-sm">{member.displayName}</span>
                  <StarPicker
                    value={memberRatings[member.id] ?? null}
                    onChange={(n) =>
                      setMemberRatings((current) => ({
                        ...current,
                        [member.id]: n,
                      }))
                    }
                  />
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">改善タグ（すべて）</p>
            <div className="flex flex-wrap gap-2">
              {IMPROVEMENT_TAGS.map((tag) => (
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
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={saved}
        className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-on-primary disabled:opacity-60"
      >
        {saved ? "保存済み" : "フィードバックを保存"}
      </button>
      {message ? (
        <p className="text-sm text-on-surface-variant" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
