import Link from "next/link";
import { YoutubeImportPanel } from "@/components/recipes/import/YoutubeImportPanel";

export default function RecipeYoutubeImportPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/recipes/new" className="text-sm font-medium text-primary">
          ← 登録方法へ戻る
        </Link>
        <h1 className="text-2xl font-bold">YouTubeからレシピを取り込む</h1>
      </header>
      <YoutubeImportPanel />
    </div>
  );
}
