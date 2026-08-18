"use client";

import { useState, useCallback } from "react";
import { getExpenseReport } from "@/app/actions/reports";
import { formatCurrency } from "@/lib/utils";
import type { ExpenseReportData } from "@/app/actions/reports";

export default function ExpenseReportClient() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(
    thirtyDaysAgo.toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [data, setData] = useState<ExpenseReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getExpenseReport({ startDate, endDate });
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Expense Report</h1>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm text-gray-600">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Generate Report"}
        </button>
      </div>

      {loading && (
        <div className="py-12 text-center text-sm text-gray-500">
          Loading report...
        </div>
      )}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Total Expenses</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {data.totalExpenses}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {formatCurrency(data.totalAmount)}
              </p>
            </div>
          </div>

          {/* Daily Breakdown */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-4 font-semibold text-gray-900">Daily Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4 text-right">Count</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.length > 0 ? (
                    data.daily.map((row) => (
                      <tr key={row.date} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{row.date}</td>
                        <td className="py-2 pr-4 text-right">{row.count}</td>
                        <td className="py-2 text-right">
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-gray-500">
                        No expenses in this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Account */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-4 font-semibold text-gray-900">
              By Expense Account
            </h2>
            {data.byAccount.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="pb-2 pr-4">Account</th>
                      <th className="pb-2 pr-4 text-right">Count</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byAccount.map((row) => (
                      <tr
                        key={row.accountName}
                        className="border-b last:border-0"
                      >
                        <td className="py-2 pr-4 font-medium">
                          {row.accountName}
                        </td>
                        <td className="py-2 pr-4 text-right">{row.count}</td>
                        <td className="py-2 text-right">
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No data</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
