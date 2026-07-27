import { redirect } from "next/navigation";

/** /budget は /food-expenses へのエイリアス */
export default function BudgetPage() {
  redirect("/food-expenses");
}
