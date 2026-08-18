import { getRefunds } from "@/app/actions/accounting";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RefundsClient from "./RefundsClient";

export default async function RefundsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getRefunds();
  const refunds = (result.data?.items ?? []).map((r) => ({
    id: r.id,
    orderNumber: r.order.orderNumber,
    amount: Number(r.amount),
    reason: r.reason,
    processedBy: r.processedBy.name ?? "Unknown",
    date: r.createdAt,
  }));
  return <RefundsClient refunds={refunds} />;
}
