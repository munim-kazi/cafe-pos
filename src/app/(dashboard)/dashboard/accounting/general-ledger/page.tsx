import { getAccounts } from "@/app/actions/accounting";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import GeneralLedgerClient from "./GeneralLedgerClient";

export default async function GeneralLedgerPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const accountsResult = await getAccounts({ active: true });
  return <GeneralLedgerClient accounts={accountsResult.data ?? []} />;
}
