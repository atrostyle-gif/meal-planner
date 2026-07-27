import { redirect } from "next/navigation";

/** 旧URL互換。生活スタイル設定は家族プロフィール内へ統合済み */
export default function LifestyleSetupRoute() {
  redirect("/settings/family-profiles?section=lifestyle");
}
