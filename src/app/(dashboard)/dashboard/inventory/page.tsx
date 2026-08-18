import { getIngredients, getLowStockIngredients } from "@/app/actions/inventory";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import InventoryDashboard from "./InventoryDashboard";

export default async function InventoryPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const [ingredientsResult, lowStockResult] = await Promise.all([
    getIngredients(),
    getLowStockIngredients(),
  ]);
  return (
    <InventoryDashboard
      ingredients={ingredientsResult.data?.ingredients ?? []}
      lowStockItems={lowStockResult.data ?? []}
      userRole={session.user.role}
    />
  );
}
