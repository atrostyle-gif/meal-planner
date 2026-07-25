import { EditInventoryPage } from "@/components/fridge/EditInventoryPage";

type EditFridgeRoutePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditFridgeRoutePage({
  params,
}: EditFridgeRoutePageProps) {
  const { id } = await params;
  return <EditInventoryPage itemId={id} />;
}
