"use client";

import { useState, useCallback } from "react";
import { getBalanceSheet } from "@/app/actions/reports";
import { formatCurrency, cn } from "@/lib/utils";
import type { BalanceSheetData } from "@/app/actions/reports";

function Section({
  title,
  items,
  total,
  totalLabel,
}: {
  title: string;
  items: { label: string; code: string; amount: number }[];
  total: number;
  totalLabel: string;
}) {
  return (
    <div className="border-b px-6 py-4">
      <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">
        {title}
      </h2>
      {items.length > 0 ? (
        items.map((item) => (
          <div key={item.code + item.label} className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-700">
              <span className="mr-2 text-xs text-gray-400">{item.code}</span>
              {item.label}
            </span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(item.amount)}
            </span>
          </div>
        ))
      ) : (
        <p className="text-sm text-gray-400">No data</p>
      )}
      <div className="mt-2 border-t pt-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">
            {totalLabel}
          </span>
          <span className="text-sm font-bold text-gray-900">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BalanceSheetClient() {
  const today = new Date();
  const [asOfDate, setAsOfDate] = useState(today.toISOString().slice(0, 10));
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getBalanceSheet({ asOfDate });
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Balance Sheet</h1>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm text-gray-600">As of Date</label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
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
          {/* Balance Indicator */}
          <div className="border-b px-6 py-3">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                data.balanced
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              )}
            >
              {data.balanced
                ? "Balanced"
                : "Not Balanced - Difference: " +
                  formatCurrency(
                    Math.abs(data.assets.total - (data.liabilities.total + data.equity.total))
                  )}
            </span>
          </div>

          <Section
            title="Assets"
            items={data.assets.items}
            total={data.assets.total}
            totalLabel="Total Assets"
          />

          <Section
            title="Liabilities"
            items={data.liabilities.items}
            total={data.liabilities.total}
            totalLabel="Total Liabilities"
          />

          <Section
            title="Equity"
            items={data.equity.items}
            total={data.equity.total}
            totalLabel="Total Equity"
          />

          {/* Total Liabilities + Equity */}
          <div className="bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">
                Total Liabilities + Equity
              </span>
              <span className="text-sm font-bold text-gray-900">
                {formatCurrency(data.liabilities.total + data.equity.total)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
