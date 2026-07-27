"use client";

import Link from "next/link";
import { useSyncExternalStore, useState } from "react";
import { useFamilySession } from "@/components/providers/FamilySessionProvider";
import {
  applyFamilyWeeklyPreset,
  getWeeklyCookingSchedulesServerSnapshot,
  getWeeklyCookingSchedulesSnapshot,
  subscribeWeeklyCookingSchedules,
  upsertWeeklyCookingSchedule,
} from "@/lib/weekly-cooking-schedules";
import {
  loadFamilyMemberProfiles,
  subscribeFamilyMemberProfiles,
  getFamilyMemberProfilesSnapshot,
  getFamilyMemberProfilesServerSnapshot,
} from "@/lib/family-member-profiles";
import {
  DAYS_OF_WEEK,
  DAY_OF_WEEK_LABELS,
  EFFORT_LEVELS,
  EFFORT_LEVEL_LABELS,
  type DayOfWeek,
  type WeeklyCookingSchedule,
} from "@/types/weekly-lifestyle";

function useSchedules(): WeeklyCookingSchedule[] {
  return useSyncExternalStore(
    subscribeWeeklyCookingSchedules,
    getWeeklyCookingSchedulesSnapshot,
    getWeeklyCookingSchedulesServerSnapshot,
  );
}

function useMembers() {
  return useSyncExternalStore(
    subscribeFamilyMemberProfiles,
    getFamilyMemberProfilesSnapshot,
    getFamilyMemberProfilesServerSnapshot,
  );
}

function createSchedule(householdId: string, dayOfWeek: DayOfWeek): WeeklyCookingSchedule {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), householdId, dayOfWeek, defaultCookMemberId: null,
    backupCookMemberIds: [], cookingTimeLimitMinutes: 45, effortLevel: "normal",
    shoppingAvailable: false, isShoppingDay: false, allowNewRecipes: true,
    preferFamiliarRecipes: false, allowBatchCooking: false, preferLowCleanup: false,
    maxStepCount: null, avoidDeepFrying: false, preferMakeAhead: false,
    notes: null, isActive: true, createdAt: now, updatedAt: now,
  };
}

export function WeeklySchedulePage() {
  const { household } = useFamilySession();
  const householdId = household?.id ?? "local";
  const schedules = useSchedules();
  const members = useMembers();
  const [message, setMessage] = useState<string | null>(null);

  function scheduleFor(day: DayOfWeek): WeeklyCookingSchedule {
    return schedules.find((item) => item.householdId === householdId && item.dayOfWeek === day)
      ?? schedules.find((item) => item.householdId === "local" && item.dayOfWeek === day)
      ?? createSchedule(householdId, day);
  }
  function save(schedule: WeeklyCookingSchedule): void {
    upsertWeeklyCookingSchedule({ ...schedule, householdId });
    setMessage(`${DAY_OF_WEEK_LABELS[schedule.dayOfWeek]}を保存しました`);
  }
  function applyPreset(): void {
    const all = members.length > 0 ? members : loadFamilyMemberProfiles();
    const find = (word: string, index: number): string | undefined =>
      all.find((member) => member.displayName.includes(word))?.id ?? all[index]?.id;
    const count = applyFamilyWeeklyPreset(householdId, {
      wife: find("妻", 0), husband: find("夫", 1), daughter: find("娘", 2),
    });
    setMessage(`家族向けプリセットを${count}日分適用しました`);
  }

  return <div className="space-y-6">
    <header className="space-y-2">
      <Link href="/settings" className="text-sm text-primary">← 設定</Link>
      <h1 className="text-2xl font-bold">週間調理スケジュール</h1>
      <p className="text-sm text-on-surface-variant">担当者と、その日の作りやすさを曜日ごとに設定します。</p>
    </header>
    <button type="button" onClick={applyPreset} className="w-full rounded-xl bg-secondary-container px-4 py-3 text-sm font-semibold text-on-secondary-container">
      家族向けプリセットを適用
    </button>
    <div className="space-y-3">
      {DAYS_OF_WEEK.map((day) => {
        const schedule = scheduleFor(day);
        return <section key={day} className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
          <h2 className="font-semibold">{DAY_OF_WEEK_LABELS[day]}</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-on-surface-variant">作る人
              <select value={schedule.defaultCookMemberId ?? ""} onChange={(e) => save({ ...schedule, defaultCookMemberId: e.target.value || null })} className="mt-1 w-full rounded-xl bg-surface-container px-3 py-2 text-sm text-on-surface">
                <option value="">未設定</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-on-surface-variant">時間の目安（分）
              <input type="number" min="0" value={schedule.cookingTimeLimitMinutes ?? ""} onChange={(e) => save({ ...schedule, cookingTimeLimitMinutes: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-surface-container px-3 py-2 text-sm text-on-surface" />
            </label>
            <label className="space-y-1 text-xs text-on-surface-variant">手間
              <select value={schedule.effortLevel} onChange={(e) => save({ ...schedule, effortLevel: e.target.value as WeeklyCookingSchedule["effortLevel"] })} className="mt-1 w-full rounded-xl bg-surface-container px-3 py-2 text-sm text-on-surface">
                {EFFORT_LEVELS.map((level) => <option key={level} value={level}>{EFFORT_LEVEL_LABELS[level]}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-on-surface-variant">工程数の上限
              <input type="number" min="1" value={schedule.maxStepCount ?? ""} onChange={(e) => save({ ...schedule, maxStepCount: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-surface-container px-3 py-2 text-sm text-on-surface" />
            </label>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {([
              ["isShoppingDay", "買い出し日"], ["shoppingAvailable", "買い物可能"], ["allowNewRecipes", "新しい料理可"],
              ["preferFamiliarRecipes", "慣れた料理優先"], ["preferLowCleanup", "洗い物少なめ"], ["avoidDeepFrying", "揚げ物を避ける"],
              ["allowBatchCooking", "作り置き可"], ["preferMakeAhead", "事前準備優先"],
            ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-1">
              <input type="checkbox" checked={schedule[key]} onChange={(e) => save({ ...schedule, [key]: e.target.checked })} />{label}
            </label>)}
          </div>
        </section>;
      })}
    </div>
    {message ? <p role="status" className="text-sm text-on-surface-variant">{message}</p> : null}
  </div>;
}
