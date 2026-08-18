import { getAccountsPayable } from "@/app/actions/accounting";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PayablesClient from "./PayablesClient";

export default async function PayablesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getAccountsPayable();
  const payables = (result.data?.suppliers ?? []).map((s) => ({
    id: s.id,
    supplierName: s.name,
    company: s.company,
    dueBalance: Number(s.dueBalance),
    unpaidPurchases: s.payables.length,
  }));
  return <PayablesClient payables={payables} />;
}
