import Link from "next/link";
import { PhotoImportPanel } from "@/components/recipes/import/PhotoImportPanel";

export default function RecipePhotoImportPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/recipes/new" className="text-sm font-medium text-primary">← 登録方法へ戻る</Link>
        <h1 className="text-2xl font-bold">写真からレシピを取り込む</h1>
      </header>
      <PhotoImportPanel />
    </div>
  );
}
