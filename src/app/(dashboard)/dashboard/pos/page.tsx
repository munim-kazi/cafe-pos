import { getMenuItems } from "@/app/actions/menu-items";
import { getTables } from "@/app/actions/tables";
import { getCustomers } from "@/app/actions/customers";
import { getCategories } from "@/app/actions/categories";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import POSScreen from "./POSScreen";

export default async function POSPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [menuItemsResult, tablesResult, customersResult, categoriesResult] =
    await Promise.all([
      getMenuItems({ available: true }),
      getTables(),
      getCustomers(),
      getCategories(),
    ]);

  return (
    <POSScreen
      menuItems={(menuItemsResult.data ?? []) as unknown as React.ComponentProps<typeof POSScreen>["menuItems"]}
      tables={(tablesResult.data ?? []) as unknown as React.ComponentProps<typeof POSScreen>["tables"]}
      customers={customersResult.data ?? []}
      categories={categoriesResult.data ?? []}
    />
  );
}
