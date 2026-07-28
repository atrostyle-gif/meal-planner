"use client";

import { useMemo, useState } from "react";
import { ProfileAccordion } from "@/components/settings/ProfileAccordion";
import { estimateStandardNutrition } from "@/lib/family-profile-helpers";
import {
  AGE_GROUPS,
  COMMON_ALLERGENS,
  COOKING_DAY_KEYS,
  COOKING_DAY_LABELS,
  DIETARY_RESTRICTIONS,
  FOOD_PREFERENCE_TAGS,
  HEALTH_CONDITION_FLAGS,
  PROFILE_ACTIVITY_LEVELS,
  PROFILE_SEXES,
  SERVING_PORTIONS,
  type AgeGroup,
  type CookingDayKey,
  type DietaryRestriction,
  type FamilyMemberProfile,
  type FamilyMemberProfileInput,
  type FoodPreferenceTag,
  type ProfileActivityLevel,
  type ProfileSex,
  type ServingPortion,
} from "@/types/family-member-profile";

export function emptyMemberDraft(
  householdId: string,
): FamilyMemberProfileInput {
  return {
    householdId,
    displayName: "",
    age: null,
    birthYear: null,
    ageGroup: "未設定",
    activityLevel: "未設定",
    sex: "未設定",
    servingPortion: "普通",
    calorieTarget: null,
    proteinTarget: null,
    fatTarget: null,
    carbTarget: null,
    saltLimit: null,
    useStandardNutrition: true,
    goals: ["バランス重視"],
    healthFlags: [],
    allergies: [],
    dislikedIngredients: [],
    likedIngredients: [],
    dietaryRestrictions: ["なし"],
    foodPreferences: [],
    cookingDays: [],
    notes: null,
    healthNotes: null,
    isActive: true,
  };
}

function ChipToggle({
  label,
  active,
  onClick,
  danger = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
        active
          ? danger
            ? "bg-error-container text-error ring-error/40"
            : "bg-primary/15 text-primary ring-primary/40"
          : "bg-surface-container text-on-surface-variant ring-outline-variant"
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

type MemberProfileEditorProps = {
  draft: FamilyMemberProfileInput;
  editingId: string | null;
  onChange: (next: FamilyMemberProfileInput) => void;
  onSave: () => void;
  onCancel: () => void;
};

/**
 * 1人分の統合プロフィール編集（アコーディオン）。
 */
export function MemberProfileEditor({
  draft,
  editingId,
  onChange,
  onSave,
  onCancel,
}: MemberProfileEditorProps) {
  const [openId, setOpenId] = useState<string>("basic");
  const [dislikeText, setDislikeText] = useState("");
  const [likeText, setLikeText] = useState("");

  const standard = useMemo(
    () =>
      estimateStandardNutrition({
        age: draft.age ?? null,
        sex: draft.sex,
        activityLevel: draft.activityLevel,
        servingPortion: draft.servingPortion,
      }),
    [draft.age, draft.sex, draft.activityLevel, draft.servingPortion],
  );

  function patch(partial: Partial<FamilyMemberProfileInput>): void {
    onChange({ ...draft, ...partial });
  }

  function toggle<T extends string>(
    key: "allergies" | "healthFlags" | "foodPreferences" | "cookingDays" | "dietaryRestrictions",
    value: T,
  ): void {
    const list = draft[key] as T[];
    const has = list.includes(value);
    if (key === "dietaryRestrictions") {
      if (value === ("なし" as T)) {
        patch({ dietaryRestrictions: ["なし"] });
        return;
      }
      const withoutNone = list.filter((item) => item !== ("なし" as T));
      patch({
        dietaryRestrictions: (has
          ? withoutNone.filter((item) => item !== value)
          : [...withoutNone, value]) as DietaryRestriction[],
      });
      return;
    }
    patch({
      [key]: has ? list.filter((item) => item !== value) : [...list, value],
    } as Partial<FamilyMemberProfileInput>);
  }

  function addIngredient(
    field: "dislikedIngredients" | "likedIngredients",
    text: string,
    clear: () => void,
  ): void {
    const name = text.trim();
    if (!name) return;
    if (draft[field].includes(name)) {
      clear();
      return;
    }
    patch({ [field]: [...draft[field], name] });
    clear();
  }

  return (
    <div className="space-y-3 rounded-2xl bg-surface-container p-3 ring-1 ring-outline-variant">
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="text-sm font-semibold">
          {editingId ? "プロフィール編集" : "新規プロフィール"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-on-surface-variant"
        >
          閉じる
        </button>
      </div>

      <ProfileAccordion
        title="基本情報"
        summary={draft.displayName || "未入力"}
        open={openId === "basic"}
        onToggle={() => setOpenId((v) => (v === "basic" ? "" : "basic"))}
      >
        <label className="block space-y-1">
          <span className="text-xs text-on-surface-variant">名前</span>
          <input
            value={draft.displayName}
            onChange={(e) => patch({ displayName: e.target.value })}
            className="w-full rounded-xl bg-surface-container-lowest px-3 py-2.5 text-sm"
            placeholder="例: ママ"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">年齢（任意）</span>
            <input
              type="number"
              min={0}
              max={120}
              value={draft.age ?? ""}
              onChange={(e) =>
                patch({
                  age: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="w-full rounded-xl bg-surface-container-lowest px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">性別（任意）</span>
            <select
              value={draft.sex ?? "未設定"}
              onChange={(e) => patch({ sex: e.target.value as ProfileSex })}
              className="w-full rounded-xl bg-surface-container-lowest px-3 py-2.5 text-sm"
            >
              {PROFILE_SEXES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">年齢層</span>
            <select
              value={draft.ageGroup}
              onChange={(e) => patch({ ageGroup: e.target.value as AgeGroup })}
              className="w-full rounded-xl bg-surface-container-lowest px-3 py-2.5 text-sm"
            >
              {AGE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-on-surface-variant">活動量</span>
            <select
              value={draft.activityLevel}
              onChange={(e) =>
                patch({
                  activityLevel: e.target.value as ProfileActivityLevel,
                })
              }
              className="w-full rounded-xl bg-surface-container-lowest px-3 py-2.5 text-sm"
            >
              {PROFILE_ACTIVITY_LEVELS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend className="text-xs text-on-surface-variant">
            通常食べる量
          </legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {SERVING_PORTIONS.map((portion) => (
              <ChipToggle
                key={portion}
                label={portion}
                active={draft.servingPortion === portion}
                onClick={() => patch({ servingPortion: portion as ServingPortion })}
              />
            ))}
          </div>
        </fieldset>
      </ProfileAccordion>

      <ProfileAccordion
        title="健康・食事"
        summary={
          draft.healthFlags.length > 0
            ? HEALTH_CONDITION_FLAGS.filter((f) =>
                draft.healthFlags.includes(f.id),
              )
                .map((f) => f.label)
                .join("・")
            : "未設定"
        }
        open={openId === "health"}
        onToggle={() => setOpenId((v) => (v === "health" ? "" : "health"))}
      >
        <fieldset>
          <legend className="text-xs text-on-surface-variant">健康状態</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {HEALTH_CONDITION_FLAGS.map((flag) => (
              <ChipToggle
                key={flag.id}
                label={flag.label}
                active={draft.healthFlags.includes(flag.id)}
                onClick={() => {
                  const has = draft.healthFlags.includes(flag.id);
                  patch({
                    healthFlags: has
                      ? draft.healthFlags.filter((id) => id !== flag.id)
                      : [...draft.healthFlags, flag.id],
                  });
                }}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs text-on-surface-variant">アレルギー</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {COMMON_ALLERGENS.map((name) => (
              <ChipToggle
                key={name}
                label={name}
                active={draft.allergies.includes(name)}
                danger
                onClick={() => toggle("allergies", name)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs text-on-surface-variant">食事制限</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {DIETARY_RESTRICTIONS.map((item) => (
              <ChipToggle
                key={item}
                label={item}
                active={draft.dietaryRestrictions.includes(item)}
                onClick={() => toggle("dietaryRestrictions", item)}
              />
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <p className="text-xs text-on-surface-variant">苦手な食材</p>
          <div className="flex gap-2">
            <input
              value={dislikeText}
              onChange={(e) => setDislikeText(e.target.value)}
              className="min-w-0 flex-1 rounded-xl bg-surface-container-lowest px-3 py-2 text-sm"
              placeholder="例: しいたけ"
            />
            <button
              type="button"
              className="rounded-xl bg-surface-container-lowest px-3 text-sm font-medium ring-1 ring-outline-variant"
              onClick={() =>
                addIngredient("dislikedIngredients", dislikeText, () =>
                  setDislikeText(""),
                )
              }
            >
              追加
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {draft.dislikedIngredients.map((name) => (
              <ChipToggle
                key={name}
                label={name}
                active
                onClick={() =>
                  patch({
                    dislikedIngredients: draft.dislikedIngredients.filter(
                      (item) => item !== name,
                    ),
                  })
                }
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-on-surface-variant">好きな食材</p>
          <div className="flex gap-2">
            <input
              value={likeText}
              onChange={(e) => setLikeText(e.target.value)}
              className="min-w-0 flex-1 rounded-xl bg-surface-container-lowest px-3 py-2 text-sm"
              placeholder="例: チーズ"
            />
            <button
              type="button"
              className="rounded-xl bg-surface-container-lowest px-3 text-sm font-medium ring-1 ring-outline-variant"
              onClick={() =>
                addIngredient("likedIngredients", likeText, () =>
                  setLikeText(""),
                )
              }
            >
              追加
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {draft.likedIngredients.map((name) => (
              <ChipToggle
                key={name}
                label={name}
                active
                onClick={() =>
                  patch({
                    likedIngredients: draft.likedIngredients.filter(
                      (item) => item !== name,
                    ),
                  })
                }
              />
            ))}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-on-surface-variant">その他自由入力</span>
          <textarea
            value={draft.healthNotes ?? ""}
            onChange={(e) => patch({ healthNotes: e.target.value || null })}
            rows={2}
            className="w-full rounded-xl bg-surface-container-lowest px-3 py-2 text-sm"
            placeholder="例: 最近血糖値が気になる"
          />
        </label>
      </ProfileAccordion>

      <ProfileAccordion
        title="栄養目標"
        summary={
          draft.useStandardNutrition
            ? `標準 · ${standard.calorieTarget}kcal`
            : `手動 · ${draft.calorieTarget ?? "—"}kcal`
        }
        open={openId === "nutrition"}
        onToggle={() =>
          setOpenId((v) => (v === "nutrition" ? "" : "nutrition"))
        }
      >
        <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-lowest px-3 py-2.5">
          <span className="text-sm">標準設定を使う</span>
          <input
            type="checkbox"
            checked={draft.useStandardNutrition}
            onChange={(e) => {
              const on = e.target.checked;
              if (on) {
                patch({
                  useStandardNutrition: true,
                  calorieTarget: standard.calorieTarget,
                  proteinTarget: standard.proteinTarget,
                  fatTarget: standard.fatTarget,
                  carbTarget: standard.carbTarget,
                });
              } else {
                patch({ useStandardNutrition: false });
              }
            }}
            className="h-5 w-5"
          />
        </label>
        <p className="text-[11px] text-on-surface-variant">
          ONで年齢・性別・活動量から自動計算します（参考値）。
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["calorieTarget", "カロリー(kcal)", standard.calorieTarget],
              ["proteinTarget", "たんぱく質(g)", standard.proteinTarget],
              ["fatTarget", "脂質(g)", standard.fatTarget],
              ["carbTarget", "炭水化物(g)", standard.carbTarget],
            ] as const
          ).map(([key, label, std]) => (
            <label key={key} className="block space-y-1">
              <span className="text-xs text-on-surface-variant">{label}</span>
              <input
                type="number"
                disabled={draft.useStandardNutrition}
                value={
                  draft.useStandardNutrition
                    ? std
                    : (draft[key] ?? "")
                }
                onChange={(e) =>
                  patch({
                    [key]:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="w-full rounded-xl bg-surface-container-lowest px-3 py-2.5 text-sm disabled:opacity-60"
              />
            </label>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-on-surface-variant">塩分上限(g・任意)</span>
          <input
            type="number"
            value={draft.saltLimit ?? ""}
            onChange={(e) =>
              patch({
                saltLimit:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="w-full rounded-xl bg-surface-container-lowest px-3 py-2.5 text-sm"
          />
        </label>
      </ProfileAccordion>

      <ProfileAccordion
        title="食事の好み"
        summary={
          draft.foodPreferences.length > 0
            ? draft.foodPreferences.join("・")
            : "未設定"
        }
        open={openId === "prefs"}
        onToggle={() => setOpenId((v) => (v === "prefs" ? "" : "prefs"))}
      >
        <p className="text-[11px] text-on-surface-variant">
          AI献立エンジンの学習・おすすめ候補に使います。
        </p>
        <div className="flex flex-wrap gap-2">
          {FOOD_PREFERENCE_TAGS.map((tag) => (
            <ChipToggle
              key={tag}
              label={tag}
              active={draft.foodPreferences.includes(tag)}
              onClick={() => toggle("foodPreferences", tag as FoodPreferenceTag)}
            />
          ))}
        </div>
      </ProfileAccordion>

      <ProfileAccordion
        title="調理"
        summary={
          draft.cookingDays.length > 0
            ? draft.cookingDays.map((d) => COOKING_DAY_LABELS[d]).join("")
            : "担当曜日なし"
        }
        open={openId === "cooking"}
        onToggle={() => setOpenId((v) => (v === "cooking" ? "" : "cooking"))}
      >
        <p className="text-[11px] text-on-surface-variant">
          料理担当曜日（週間スケジュールにも反映）
        </p>
        <div className="flex flex-wrap gap-2">
          {COOKING_DAY_KEYS.map((day) => (
            <ChipToggle
              key={day}
              label={COOKING_DAY_LABELS[day]}
              active={draft.cookingDays.includes(day)}
              onClick={() => toggle("cookingDays", day as CookingDayKey)}
            />
          ))}
        </div>
      </ProfileAccordion>

      <ProfileAccordion
        title="AIメモ"
        summary={draft.notes?.slice(0, 24) || "未入力"}
        open={openId === "ai"}
        onToggle={() => setOpenId((v) => (v === "ai" ? "" : "ai"))}
      >
        <textarea
          value={draft.notes ?? ""}
          onChange={(e) => patch({ notes: e.target.value || null })}
          rows={4}
          className="w-full rounded-xl bg-surface-container-lowest px-3 py-2 text-sm"
          placeholder={"例:\n・朝は少なめ\n・辛いもの苦手\n・娘はチーズ好き"}
        />
        <p className="text-[11px] text-on-surface-variant">
          献立作成時の参考情報として利用します。
        </p>
      </ProfileAccordion>

      <button
        type="button"
        onClick={onSave}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
      >
        保存する
      </button>
    </div>
  );
}

export function profileToDraft(
  profile: FamilyMemberProfile,
  householdId: string,
): FamilyMemberProfileInput {
  return {
    ...profile,
    householdId: profile.householdId || householdId,
  };
}
