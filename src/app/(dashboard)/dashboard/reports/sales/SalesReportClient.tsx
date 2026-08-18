"use client";

import { useState, useCallback } from "react";
import { getSalesReport } from "@/app/actions/reports";
import { formatCurrency } from "@/lib/utils";
import type { SalesReportData } from "@/app/actions/reports";

function BarChart({
  data,
  height = 120,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-gray-500">
            {d.value > 0 ? formatCurrency(d.value) : ""}
          </span>
          <div
            className="w-full rounded-t bg-indigo-500"
            style={{
              height: `${Math.max((d.value / max) * 100, 2)}%`,
              minHeight: d.value > 0 ? 4 : 0,
            }}
          />
          <span className="text-[9px] text-gray-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function SalesReportClient() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(
    thirtyDaysAgo.toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [data, setData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSalesReport({ startDate, endDate });
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch {
      // Error is handled by toast
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>

      {/* Date Range Picker */}
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
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {data.totalOrders}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatCurrency(data.totalRevenue)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Avg Order Value</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatCurrency(data.avgOrderValue)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Tax Collected</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatCurrency(data.totalTax)}
              </p>
            </div>
          </div>

          {/* Daily Revenue Chart */}
          {data.daily.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-4 font-semibold text-gray-900">
                Daily Revenue
              </h2>
              <BarChart
                data={data.daily.map((d) => ({
                  label: d.date.slice(5),
                  value: d.revenue,
                }))}
                height={160}
              />
            </div>
          )}

          {/* Daily Breakdown Table */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-4 font-semibold text-gray-900">
              Daily Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4 text-right">Orders</th>
                    <th className="pb-2 pr-4 text-right">Revenue</th>
                    <th className="pb-2 pr-4 text-right">Tax</th>
                    <th className="pb-2 pr-4 text-right">Discounts</th>
                    <th className="pb-2 text-right">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((row) => (
                    <tr
                      key={row.date}
                      className="border-b last:border-0"
                    >
                      <td className="py-2 pr-4 font-medium">{row.date}</td>
                      <td className="py-2 pr-4 text-right">{row.orders}</td>
                      <td className="py-2 pr-4 text-right">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {formatCurrency(row.tax)}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {formatCurrency(row.discounts)}
                      </td>
                      <td className="py-2 text-right">
                        {formatCurrency(row.avgOrder)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* By Payment Method */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-4 font-semibold text-gray-900">
                By Payment Method
              </h2>
              {data.byPaymentMethod.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="pb-2 pr-4">Method</th>
                      <th className="pb-2 pr-4 text-right">Count</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byPaymentMethod.map((row) => (
                      <tr
                        key={row.method}
                        className="border-b last:border-0"
                      >
                        <td className="py-2 pr-4 font-medium">
                          {row.method.replace("_", " ")}
                        </td>
                        <td className="py-2 pr-4 text-right">{row.count}</td>
                        <td className="py-2 text-right">
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-500">No data</p>
              )}
            </div>

            {/* By Order Type */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-4 font-semibold text-gray-900">
                By Order Type
              </h2>
              {data.byOrderType.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500">
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4 text-right">Count</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byOrderType.map((row) => (
                      <tr
                        key={row.type}
                        className="border-b last:border-0"
                      >
                        <td className="py-2 pr-4 font-medium">
                          {row.type.replace("_", " ")}
                        </td>
                        <td className="py-2 pr-4 text-right">{row.count}</td>
                        <td className="py-2 text-right">
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-500">No data</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
