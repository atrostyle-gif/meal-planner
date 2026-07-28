import { redirect } from "next/navigation";

/**
 * 週間スケジュール設定は家族プロフィールの担当曜日へ統合。
 * 旧URL互換のためのリダイレクト。
 */
export default function WeeklyScheduleRoutePage() {
  redirect("/settings/family-profiles?section=members");
}
