import { redirect } from "next/navigation";

/** トップは今日の献立へ誘導 */
export default function HomePage() {
  redirect("/today");
}
