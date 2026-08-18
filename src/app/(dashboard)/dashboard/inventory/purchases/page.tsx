import { getPurchases } from "@/app/actions/purchases";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PurchasesClient from "./PurchasesClient";

export default async function PurchasesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const purchasesResult = await getPurchases({ page: 1, pageSize: 20 });
  return (
    <PurchasesClient
      initialPurchases={purchasesResult.data}
      userRole={session.user.role}
    />
  );
}
