"use client";

import { useState, useCallback } from "react";
import { getPaymentMethodReport } from "@/app/actions/reports";
import { formatCurrency, cn } from "@/lib/utils";
import type { PaymentMethodReportData } from "@/app/actions/reports";

const methodColors: Record<string, string> = {
  CASH: "bg-emerald-500",
  CARD: "bg-indigo-500",
  MOBILE: "bg-cyan-500",
  BANK_TRANSFER: "bg-amber-500",
};

function BarChart({
  data,
}: {
  data: { label: string; value: number; percentage: number }[];
}) {
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-sm font-medium text-gray-700">
            {d.label}
          </span>
          <div className="flex-1">
            <div className="h-6 w-full overflow-hidden rounded bg-gray-100">
              <div
                className={cn(
                  "h-full rounded",
                  methodColors[d.label] ?? "bg-gray-400"
                )}
                style={{
                  width: `${Math.max(d.percentage, 2)}%`,
                }}
              />
            </div>
          </div>
          <span className="w-20 shrink-0 text-right text-sm font-medium text-gray-700">
            {d.percentage}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PaymentMethodClient() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(
    thirtyDaysAgo.toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [data, setData] = useState<PaymentMethodReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPaymentMethodReport({ startDate, endDate });
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
      <h1 className="text-2xl font-bold text-gray-900">Payment Analysis</h1>

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
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-4 font-semibold text-gray-900">
              Distribution
            </h2>
            {data.methods.length > 0 ? (
              <BarChart
                data={data.methods.map((m) => ({
                  label: m.method,
                  value: m.total,
                  percentage: m.percentage,
                }))}
              />
            ) : (
              <p className="text-sm text-gray-500">No payment data</p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-4 font-semibold text-gray-900">
              Detailed Breakdown
            </h2>
            {data.methods.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="pb-2 pr-4">Method</th>
                      <th className="pb-2 pr-4 text-right">Transactions</th>
                      <th className="pb-2 pr-4 text-right">Total</th>
                      <th className="pb-2 text-right">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.methods.map((row) => (
                      <tr
                        key={row.method}
                        className="border-b last:border-0"
                      >
                        <td className="py-2 pr-4">
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-block h-2 w-2 rounded-full",
                                methodColors[row.method] ?? "bg-gray-400"
                              )}
                            />
                            <span className="font-medium">
                              {row.method.replace("_", " ")}
                            </span>
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right">{row.count}</td>
                        <td className="py-2 pr-4 text-right font-medium">
                          {formatCurrency(row.total)}
                        </td>
                        <td className="py-2 text-right">{row.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-bold">
                      <td className="py-2 pr-4">Total</td>
                      <td className="py-2 pr-4 text-right">
                        {data.methods.reduce((s, m) => s + m.count, 0)}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {formatCurrency(data.grandTotal)}
                      </td>
                      <td className="py-2 text-right">100%</td>
                    </tr>
                  </tfoot>
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
