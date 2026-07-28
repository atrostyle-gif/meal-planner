import { redirect } from "next/navigation";

/** 調理担当は家族プロフィールの「調理」セクションへ統合 */
export default function CookingMembersRoutePage() {
  redirect("/settings/family-profiles?section=members");
}
