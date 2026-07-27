import { redirect } from "next/navigation";

/** 旧URL互換。健康・体重管理設定は家族プロフィール内へ統合済み */
export default function DiabetesMealSupportSettingsRoute() {
  redirect("/settings/family-profiles?section=health");
}
