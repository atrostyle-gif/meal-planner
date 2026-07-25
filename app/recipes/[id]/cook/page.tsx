import { Suspense } from "react";
import { CookModePage } from "@/components/cook/CookModePage";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="text-sm text-on-surface-variant">読み込み中…</p>}>
      <CookModePage recipeId={id} />
    </Suspense>
  );
}
