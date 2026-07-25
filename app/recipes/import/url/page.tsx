import Link from "next/link";
import { UrlImportPanel } from "@/components/recipes/import/UrlImportPanel";

export default function RecipeUrlImportPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/recipes/new" className="text-sm font-medium text-primary">← 登録方法へ戻る</Link>
        <h1 className="text-2xl font-bold">URLからレシピを取り込む</h1>
      </header>
      <UrlImportPanel />
    </div>
  );
}
