import { getExpenses, getAccounts } from "@/app/actions/accounting";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ExpensesClient from "./ExpensesClient";

export default async function ExpensesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const [expensesResult, accountsResult] = await Promise.all([
    getExpenses(),
    getAccounts({ active: true }),
  ]);
  const accountMap = new Map((accountsResult.data ?? []).map((a) => [a.id, a.name]));
  const expenses = (expensesResult.data?.items ?? []).map((e) => ({
    id: e.id,
    description: e.description,
    amount: Number(e.amount),
    date: e.date,
    accountName: accountMap.get(e.accountId) ?? "Unknown",
    createdBy: e.createdBy.name ?? "Unknown",
  }));
  return (
    <ExpensesClient
      expenses={expenses}
      accounts={accountsResult.data ?? []}
    />
  );
}
