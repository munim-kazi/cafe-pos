import { getRecipes, getIngredients } from "@/app/actions/inventory";
import { getMenuItems } from "@/app/actions/menu-items";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RecipesClient from "./RecipesClient";

export default async function RecipesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const [recipesResult, menuItemsResult, ingredientsResult] = await Promise.all([
    getRecipes(),
    getMenuItems(),
    getIngredients(),
  ]);
  return (
    <RecipesClient
      initialRecipes={recipesResult.data ?? []}
      menuItems={menuItemsResult.data ?? []}
      ingredients={ingredientsResult.data?.ingredients ?? []}
      userRole={session.user.role}
    />
  );
}
