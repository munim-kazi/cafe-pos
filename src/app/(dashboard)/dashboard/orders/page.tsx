import { getOrders } from "@/app/actions/orders";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";

export default async function OrdersPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getOrders({ page: 1, pageSize: 20 });
  return <OrdersClient initialOrders={result.data?.items ?? []} />;
}
