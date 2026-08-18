import { getTrialBalance } from "@/app/actions/accounting";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TrialBalanceClient from "./TrialBalanceClient";

export default async function TrialBalancePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const now = new Date();
  const result = await getTrialBalance({ year: now.getFullYear(), month: now.getMonth() + 1 });
  return (
    <TrialBalanceClient
      initialData={result.data?.accounts ?? []}
      initialYear={now.getFullYear()}
      initialMonth={now.getMonth() + 1}
    />
  );
}
