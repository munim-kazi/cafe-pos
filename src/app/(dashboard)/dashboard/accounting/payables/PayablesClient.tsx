"use client";

import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
type PayableItem = { id: string; supplierName: string; company: string | null; dueBalance: number; unpaidPurchases: number };

export default function PayablesClient({ payables }: { payables: PayableItem[] }) {
  const totalDue = payables.reduce((s, p) => s + p.dueBalance, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Accounts Payable</h1>
      <p className="mt-1 text-sm text-gray-500">Supplier outstanding balances.</p>

      {payables.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No outstanding balances" description="All supplier accounts are settled." />
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Company</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Due Balance</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Unpaid Purchases</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {payables.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{p.supplierName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{p.company ?? "\u2014"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-red-600">{formatCurrency(p.dueBalance)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">{p.unpaidPurchases}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">Total Due</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-red-600">{formatCurrency(totalDue)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="mt-6 space-y-3 md:hidden">
            {payables.map((p) => (
              <div key={p.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.supplierName}</p>
                    <p className="text-xs text-gray-500">{p.company ?? "No company"} &middot; {p.unpaidPurchases} unpaid purchases</p>
                  </div>
                  <p className="text-sm font-medium text-red-600">{formatCurrency(p.dueBalance)}</p>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
              <p className="text-sm font-bold text-gray-900">Total Due: <span className="text-red-600">{formatCurrency(totalDue)}</span></p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
