import { getTrialBalance, getAccountBalances } from "@/app/actions/accounting";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AccountingDashboard from "./AccountingDashboard";

export default async function AccountingPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const now = new Date();
  const [trialResult, balancesResult] = await Promise.all([
    getTrialBalance({ year: now.getFullYear(), month: now.getMonth() + 1 }),
    getAccountBalances({ year: now.getFullYear(), month: now.getMonth() + 1 }),
  ]);
  const balances = (balancesResult.data ?? []).map((b) => ({
    accountType: b.account.type,
    netBalance: Number(b.debitTotal) - Number(b.creditTotal),
  }));
  return (
    <AccountingDashboard
      trialBalance={trialResult.data?.accounts}
      accountBalances={balances}
    />
  );
}
