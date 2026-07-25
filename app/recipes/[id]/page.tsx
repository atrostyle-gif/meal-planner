import { RecipeDetailPage } from "@/components/recipes/RecipeDetailPage";

type RecipeDetailRoutePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RecipeDetailRoutePage({
  params,
}: RecipeDetailRoutePageProps) {
  const { id } = await params;
  return <RecipeDetailPage recipeId={id} />;
}
