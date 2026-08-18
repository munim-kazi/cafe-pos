import { getSuppliers } from "@/app/actions/suppliers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SuppliersClient from "./SuppliersClient";

export default async function SuppliersPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getSuppliers();
  return <SuppliersClient initialSuppliers={result.data ?? []} userRole={session.user.role} />;
}
