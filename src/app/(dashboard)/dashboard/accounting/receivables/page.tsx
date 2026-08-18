import { getAccountsReceivable } from "@/app/actions/accounting";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReceivablesClient from "./ReceivablesClient";

export default async function ReceivablesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getAccountsReceivable();
  const receivables = (result.data?.customers ?? []).map((c) => ({
    id: c.id,
    customerName: c.name,
    phone: c.phone,
    dueBalance: Number(c.dueBalance),
    unpaidOrders: c.receivables.length,
  }));
  return <ReceivablesClient receivables={receivables} />;
}
