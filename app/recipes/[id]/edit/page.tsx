import { EditRecipePage } from "@/components/recipes/EditRecipePage";

type EditRecipeRoutePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditRecipeRoutePage({
  params,
}: EditRecipeRoutePageProps) {
  const { id } = await params;
  return <EditRecipePage recipeId={id} />;
}
