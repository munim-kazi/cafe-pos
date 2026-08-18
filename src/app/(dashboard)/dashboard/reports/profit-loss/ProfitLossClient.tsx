"use client";

import { useState, useCallback } from "react";
import { getProfitLossReport } from "@/app/actions/reports";
import { formatCurrency, cn } from "@/lib/utils";
import type { ProfitLossData } from "@/app/actions/reports";

function SectionRow({
  label,
  amount,
  color,
}: {
  label: string;
  amount: number;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-700">{label}</span>
      <span className={cn("text-sm font-medium", color ?? "text-gray-900")}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

export default function ProfitLossClient() {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  const [startDate, setStartDate] = useState(
    startOfYear.toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [data, setData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getProfitLossReport({ startDate, endDate });
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
      <h1 className="text-2xl font-bold text-gray-900">Profit & Loss</h1>

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
        <div className="max-w-2xl space-y-0 rounded-lg border border-gray-200 bg-white">
          {/* Revenue Section */}
          <div className="border-b px-6 py-4">
            <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">
              Revenue
            </h2>
            {data.revenue.items.length > 0 ? (
              data.revenue.items.map((item) => (
                <SectionRow key={item.label} label={item.label} amount={item.amount} />
              ))
            ) : (
              <p className="text-sm text-gray-400">No revenue data</p>
            )}
            <div className="mt-2 border-t pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  Total Revenue
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {formatCurrency(data.revenue.total)}
                </span>
              </div>
            </div>
          </div>

          {/* COGS Section */}
          {data.cogs.items.length > 0 && (
            <div className="border-b px-6 py-4">
              <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">
                Cost of Goods Sold
              </h2>
              {data.cogs.items.map((item) => (
                <SectionRow
                  key={item.label}
                  label={item.label}
                  amount={item.amount}
                  color="text-red-600"
                />
              ))}
              <div className="mt-2 border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    Total COGS
                  </span>
                  <span className="text-sm font-bold text-red-600">
                    {formatCurrency(data.cogs.total)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Gross Profit */}
          <div className="border-b bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">
                Gross Profit
              </span>
              <span
                className={cn(
                  "text-sm font-bold",
                  data.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"
                )}
              >
                {formatCurrency(data.grossProfit)}
              </span>
            </div>
          </div>

          {/* Operating Expenses */}
          <div className="border-b px-6 py-4">
            <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">
              Operating Expenses
            </h2>
            {data.expenses.items.length > 0 ? (
              data.expenses.items.map((item) => (
                <SectionRow
                  key={item.label}
                  label={item.label}
                  amount={item.amount}
                  color="text-red-600"
                />
              ))
            ) : (
              <p className="text-sm text-gray-400">No expense data</p>
            )}
            <div className="mt-2 border-t pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  Total Expenses
                </span>
                <span className="text-sm font-bold text-red-600">
                  {formatCurrency(data.expenses.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Net Income */}
          <div className="bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-gray-900">
                Net Income
              </span>
              <span
                className={cn(
                  "text-base font-bold",
                  data.netIncome >= 0 ? "text-emerald-600" : "text-red-600"
                )}
              >
                {formatCurrency(data.netIncome)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
