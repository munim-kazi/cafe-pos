import { getCustomers } from "@/app/actions/customers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import CustomersClient from "./CustomersClient";

export default async function CustomersPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getCustomers();
  return <CustomersClient initialCustomers={result.data ?? []} userRole={session.user.role} />;
}
