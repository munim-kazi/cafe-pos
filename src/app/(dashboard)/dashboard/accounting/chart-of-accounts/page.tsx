import { getAccounts } from "@/app/actions/accounting";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ChartOfAccountsClient from "./ChartOfAccountsClient";

export default async function ChartOfAccountsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const result = await getAccounts();
  return <ChartOfAccountsClient accounts={result.data ?? []} />;
}
