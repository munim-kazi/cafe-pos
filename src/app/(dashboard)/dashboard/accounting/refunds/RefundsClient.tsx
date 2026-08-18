"use client";

import { useState, useCallback } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRefunds } from "@/app/actions/accounting";

type RefundItem = { id: string; orderNumber: string; amount: number; reason: string; processedBy: string; date: Date };

export default function RefundsClient({ refunds: initial }: { refunds: RefundItem[] }) {
  const [refunds, setRefunds] = useState(initial);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    const result = await getRefunds({ page: 1, pageSize: 100 });
    setLoading(false);
    if (result.success && result.data) {
      setRefunds(result.data.items.map((r) => ({
        id: r.id,
        orderNumber: r.order.orderNumber,
        amount: Number(r.amount),
        reason: r.reason,
        processedBy: r.processedBy.name ?? "Unknown",
        date: r.createdAt,
      })));
    }
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Refunds</h1>
      <p className="mt-1 text-sm text-gray-500">View all processed refunds.</p>

      {/* Date Filter */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <button onClick={fetchRefunds} disabled={loading} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {loading ? "Loading..." : "Apply"}
        </button>
      </div>

      {loading ? (
        <div className="mt-6 text-center text-sm text-gray-500">Loading...</div>
      ) : refunds.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No refunds found" description="No refunds match your criteria." />
        </div>
      ) : (
        <div className="mt-6 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Refund#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Order#</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Processed By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {refunds.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">REF-{r.id.slice(-6).toUpperCase()}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-indigo-600">{r.orderNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-red-600">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{r.reason}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{r.processedBy}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{formatDate(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile */}
      <div className="mt-6 space-y-3 md:hidden">
        {refunds.map((r) => (
          <div key={r.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Order: {r.orderNumber}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.reason}</p>
                <p className="text-xs text-gray-400">{r.processedBy} &middot; {formatDate(r.date)}</p>
              </div>
              <p className="text-sm font-medium text-red-600">{formatCurrency(r.amount)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
