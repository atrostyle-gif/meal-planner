import { redirect } from "next/navigation";

/** 旧URL互換: 栄養ダッシュボードはデータ配下へ */
export default function NutritionRoutePage() {
  redirect("/data/nutrition");
}
