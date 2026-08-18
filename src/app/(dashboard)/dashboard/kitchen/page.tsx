import { getKitchenOrders } from "@/app/actions/kitchen";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import KitchenDisplay from "./KitchenDisplay";

export default async function KitchenPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getKitchenOrders();
  return (
    <KitchenDisplay
      initialKOTs={result.data ?? []}
      userRole={session.user.role}
    />
  );
}
