import { redirect } from "next/navigation";

/** 旧URL互換: AI分析はデータ配下へ */
export default function AiLearningSettingsRedirectPage() {
  redirect("/data/ai");
}
