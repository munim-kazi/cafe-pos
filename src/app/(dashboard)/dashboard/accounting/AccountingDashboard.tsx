"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
type TrialBalanceItem = { code: string; name: string; debitTotal: number; creditTotal: number };
type AccountBalanceSummary = { accountType: string; netBalance: number };

const NAV_CARDS = [
  { label: "Chart of Accounts", href: "/dashboard/accounting/chart-of-accounts", desc: "Manage your accounts" },
  { label: "Journal Entries", href: "/dashboard/accounting/journal-entries", desc: "View all entries" },
  { label: "General Ledger", href: "/dashboard/accounting/general-ledger", desc: "Account details" },
  { label: "Trial Balance", href: "/dashboard/accounting/trial-balance", desc: "Period balances" },
  { label: "Accounts Receivable", href: "/dashboard/accounting/receivables", desc: "Customer dues" },
  { label: "Accounts Payable", href: "/dashboard/accounting/payables", desc: "Supplier dues" },
  { label: "Refunds", href: "/dashboard/accounting/refunds", desc: "Refund history" },
  { label: "Expenses", href: "/dashboard/accounting/expenses", desc: "Track expenses" },
  { label: "Audit Log", href: "/dashboard/accounting/audit-log", desc: "Activity history" },
];

export default function AccountingDashboard({
  trialBalance,
  accountBalances,
}: {
  trialBalance?: TrialBalanceItem[];
  accountBalances?: AccountBalanceSummary[];
}) {
  const balances = accountBalances ?? [];
  const totalAssets = balances.filter((b) => b.accountType === "ASSET").reduce((s, b) => s + b.netBalance, 0);
  const totalLiabilities = balances.filter((b) => b.accountType === "LIABILITY").reduce((s, b) => s + b.netBalance, 0);
  const totalEquity = balances.filter((b) => b.accountType === "EQUITY").reduce((s, b) => s + b.netBalance, 0);
  const totalRevenue = balances.filter((b) => b.accountType === "REVENUE").reduce((s, b) => s + b.netBalance, 0);
  const totalExpenses = balances.filter((b) => b.accountType === "EXPENSE").reduce((s, b) => s + b.netBalance, 0);

  const tb = trialBalance ?? [];
  const totalDebits = tb.reduce((s, b) => s + b.debitTotal, 0);
  const totalCredits = tb.reduce((s, b) => s + b.creditTotal, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Accounting</h1>
      <p className="mt-1 text-sm text-gray-500">Double-entry bookkeeping and financial overview.</p>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Total Assets" value={formatCurrency(totalAssets)} color="text-blue-600" />
        <StatCard label="Total Liabilities" value={formatCurrency(totalLiabilities)} color="text-red-600" />
        <StatCard label="Total Equity" value={formatCurrency(totalEquity)} color="text-purple-600" />
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} color="text-green-600" />
        <StatCard label="Total Expenses" value={formatCurrency(totalExpenses)} color="text-orange-600" />
      </div>

      {/* Trial Balance Summary */}
      <div className="mt-6 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Current Period Trial Balance</h2>
          <span
            className={
              "rounded-full px-2 py-0.5 text-xs font-medium " +
              (isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")
            }
          >
            {isBalanced ? "Balanced" : "Unbalanced"}
          </span>
        </div>
        <div className="mt-2 flex gap-6">
          <div>
            <p className="text-xs text-gray-500">Total Debits</p>
            <p className="text-sm font-medium text-gray-900">{formatCurrency(totalDebits)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Credits</p>
            <p className="text-sm font-medium text-gray-900">{formatCurrency(totalCredits)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Difference</p>
            <p className="text-sm font-medium text-gray-900">{formatCurrency(Math.abs(totalDebits - totalCredits))}</p>
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="block rounded-lg border border-gray-200 p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <h3 className="text-base font-semibold text-gray-900">{card.label}</h3>
            <p className="mt-1 text-sm text-gray-500">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={"mt-1 text-lg font-bold " + color}>{value}</p>
    </div>
  );
}
