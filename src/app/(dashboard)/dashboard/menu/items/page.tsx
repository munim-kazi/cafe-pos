import { getMenuItems } from "@/app/actions/menu-items";
import { getCategories } from "@/app/actions/categories";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import MenuItemsClient from "./MenuItemsClient";

export default async function MenuItemsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const [itemsResult, categoriesResult] = await Promise.all([
    getMenuItems(),
    getCategories(),
  ]);
  return (
    <MenuItemsClient
      initialItems={itemsResult.data ?? []}
      categories={categoriesResult.data ?? []}
      userRole={session.user.role}
    />
  );
}
