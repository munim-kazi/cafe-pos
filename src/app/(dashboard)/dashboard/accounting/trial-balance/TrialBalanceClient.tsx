"use client";

import { useState, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { getTrialBalance } from "@/app/actions/accounting";
import type { TrialBalanceEntry } from "@/app/actions/accounting";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function TrialBalanceClient({
  initialData,
  initialYear,
  initialMonth,
}: {
  initialData: TrialBalanceEntry[];
  initialYear: number;
  initialMonth: number;
}) {
  const [data, setData] = useState(initialData);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await getTrialBalance({ year, month });
    setLoading(false);
    if (result.success && result.data) {
      setData(result.data.accounts);
    }
  }, [year, month]);

  const totalDebits = data.reduce((s, b) => s + b.debitTotal, 0);
  const totalCredits = data.reduce((s, b) => s + b.creditTotal, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Trial Balance</h1>
      <p className="mt-1 text-sm text-gray-500">Verify that debits equal credits for a given period.</p>

      {/* Period Selector */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <button onClick={fetchData} disabled={loading} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Balance Indicator */}
      <div className="mt-4 flex items-center gap-2">
        <span className={"inline-flex rounded-full px-3 py-1 text-xs font-medium " + (isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
          {isBalanced ? "Balanced" : "Unbalanced"}
        </span>
        <span className="text-sm text-gray-500">
          Difference: {formatCurrency(Math.abs(totalDebits - totalCredits))}
        </span>
      </div>

      {data.length === 0 ? (
        <div className="mt-6 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">No data</h3>
          <p className="mt-1 text-sm text-gray-500">No account balances for this period.</p>
        </div>
      ) : (
        <div className="mt-6 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Account Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{item.code}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{item.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={"inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + typeBadgeColor(item.type)}>
                        {item.type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                      {item.debitTotal > 0 ? formatCurrency(item.debitTotal) : "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                      {item.creditTotal > 0 ? formatCurrency(item.creditTotal) : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-900">Totals</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(totalDebits)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(totalCredits)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function typeBadgeColor(type: string): string {
  switch (type) {
    case "ASSET": return "bg-blue-100 text-blue-800";
    case "LIABILITY": return "bg-red-100 text-red-800";
    case "EQUITY": return "bg-purple-100 text-purple-800";
    case "REVENUE": return "bg-green-100 text-green-800";
    case "EXPENSE": return "bg-orange-100 text-orange-800";
    default: return "bg-gray-100 text-gray-600";
  }
}
