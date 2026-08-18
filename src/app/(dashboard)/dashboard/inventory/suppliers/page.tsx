import { getSupplierPayments } from "@/app/actions/purchases";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SupplierPaymentsClient from "./SupplierPaymentsClient";

export default async function SupplierPaymentsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const paymentsResult = await getSupplierPayments();
  return (
    <SupplierPaymentsClient
      supplierPayments={paymentsResult.data?.items ?? []}
      userRole={session.user.role}
    />
  );
}
