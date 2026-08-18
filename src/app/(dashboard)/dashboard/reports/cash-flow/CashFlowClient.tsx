"use client";

import { useState, useCallback } from "react";
import { getCashFlowReport } from "@/app/actions/reports";
import { formatCurrency, cn } from "@/lib/utils";
import type { CashFlowData } from "@/app/actions/reports";

function BarChart({
  data,
  height = 120,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-gray-500">
            {d.value !== 0 ? formatCurrency(d.value) : ""}
          </span>
          <div
            className={cn(
              "w-full rounded-t",
              d.value >= 0 ? "bg-emerald-500" : "bg-red-400"
            )}
            style={{
              height: `${Math.max((Math.abs(d.value) / maxAbs) * 100, 2)}%`,
              minHeight: d.value !== 0 ? 4 : 0,
            }}
          />
          <span className="text-[9px] text-gray-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function CashFlowClient() {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  const [startDate, setStartDate] = useState(
    startOfYear.toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCashFlowReport({ startDate, endDate });
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
      <h1 className="text-2xl font-bold text-gray-900">Cash Flow</h1>

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
          {/* Monthly Net Cash Flow Chart */}
          {data.monthly.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-4 font-semibold text-gray-900">
                Monthly Net Cash Flow
              </h2>
              <BarChart
                data={data.monthly.map((m) => ({
                  label: m.month,
                  value: m.net,
                }))}
                height={160}
              />
            </div>
          )}

          {/* Monthly Table */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-4 font-semibold text-gray-900">
              Monthly Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4">Month</th>
                    <th className="pb-2 pr-4 text-right">Inflows</th>
                    <th className="pb-2 pr-4 text-right">Outflows</th>
                    <th className="pb-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((row) => (
                    <tr key={row.month} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{row.month}</td>
                      <td className="py-2 pr-4 text-right text-emerald-600">
                        {formatCurrency(row.inflows)}
                      </td>
                      <td className="py-2 pr-4 text-right text-red-600">
                        {formatCurrency(row.outflows)}
                      </td>
                      <td
                        className={cn(
                          "py-2 text-right font-medium",
                          row.net >= 0 ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {formatCurrency(row.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-bold">
                    <td className="py-2 pr-4">Total</td>
                    <td className="py-2 pr-4 text-right text-emerald-600">
                      {formatCurrency(data.totalInflows)}
                    </td>
                    <td className="py-2 pr-4 text-right text-red-600">
                      {formatCurrency(data.totalOutflows)}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right",
                        data.totalNet >= 0 ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      {formatCurrency(data.totalNet)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
