import { getSuppliers } from "@/app/actions/suppliers";
import { getIngredients } from "@/app/actions/inventory";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreatePurchaseClient from "./CreatePurchaseClient";

export default async function NewPurchasePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const [suppliersResult, ingredientsResult] = await Promise.all([
    getSuppliers(),
    getIngredients(),
  ]);
  return (
    <CreatePurchaseClient
      suppliers={suppliersResult.data ?? []}
      ingredients={ingredientsResult.data?.ingredients ?? []}
    />
  );
}
