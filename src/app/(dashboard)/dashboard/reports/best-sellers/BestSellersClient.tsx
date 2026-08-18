"use client";

import { useState, useCallback } from "react";
import { getBestSellingProducts } from "@/app/actions/reports";
import { formatCurrency } from "@/lib/utils";
import type { BestSellingProduct } from "@/app/actions/reports";

function HorizontalBarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs text-gray-700">
            {d.label}
          </span>
          <div className="flex-1">
            <div className="h-5 w-full overflow-hidden rounded bg-gray-100">
              <div
                className="h-full rounded bg-indigo-500"
                style={{ width: `${Math.max((d.value / max) * 100, 2)}%` }}
              />
            </div>
          </div>
          <span className="w-20 shrink-0 text-right text-xs font-medium text-gray-700">
            {formatCurrency(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function BestSellersClient() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(
    thirtyDaysAgo.toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [data, setData] = useState<BestSellingProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getBestSellingProducts({
        startDate,
        endDate,
        limit: 10,
      });
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const top10ForChart = data.slice(0, 10).map((p) => ({
    label: p.name,
    value: p.revenue,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Best Sellers</h1>

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

      {!loading && data.length > 0 && (
        <>
          {/* Horizontal Bar Chart */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-4 font-semibold text-gray-900">
              Top 10 by Revenue
            </h2>
            <HorizontalBarChart data={top10ForChart} />
          </div>

          {/* Full Table */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-4 font-semibold text-gray-900">
              Detailed Ranking
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2 pr-4">Product</th>
                    <th className="pb-2 pr-4">Category</th>
                    <th className="pb-2 pr-4 text-right">Qty Sold</th>
                    <th className="pb-2 pr-4 text-right">Revenue</th>
                    <th className="pb-2 text-right">Avg Price</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr key={item.rank} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-gray-500">{item.rank}</td>
                      <td className="py-2 pr-4 font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="py-2 pr-4 text-gray-500">
                        {item.category}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {item.quantitySold}
                      </td>
                      <td className="py-2 pr-4 text-right font-medium">
                        {formatCurrency(item.revenue)}
                      </td>
                      <td className="py-2 text-right">
                        {formatCurrency(item.avgPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && data.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
          Click &quot;Generate Report&quot; to see best selling products
        </div>
      )}
    </div>
  );
}
