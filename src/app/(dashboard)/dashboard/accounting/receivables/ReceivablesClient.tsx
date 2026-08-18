"use client";

import { useState, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { processCustomerPayment, getAccountsReceivable } from "@/app/actions/accounting";

type ReceivableItem = { id: string; customerName: string; phone: string | null; dueBalance: number; unpaidOrders: number };

export default function ReceivablesClient({ receivables: initial }: { receivables: ReceivableItem[] }) {
  const [receivables, setReceivables] = useState(initial);
  const [payModalCustomer, setPayModalCustomer] = useState<ReceivableItem | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payReference, setPayReference] = useState("");
  const [paying, setPaying] = useState(false);

  const totalDue = receivables.reduce((s, r) => s + r.dueBalance, 0);

  const handlePay = useCallback(async () => {
    if (!payModalCustomer || !payAmount) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) return;
    setPaying(true);
    const result = await processCustomerPayment(payModalCustomer.id, { amount, reference: payReference || undefined });
    setPaying(false);
    if (result.success) {
      setPayModalCustomer(null);
      setPayAmount("");
      setPayReference("");
      const refreshed = await getAccountsReceivable();
      if (refreshed.success && refreshed.data) {
        setReceivables(refreshed.data.customers.map((c) => ({
          id: c.id,
          customerName: c.name,
          phone: c.phone,
          dueBalance: Number(c.dueBalance),
          unpaidOrders: c.receivables.length,
        })));
      }
    } else {
      alert(result.error ?? "Failed to record payment");
    }
  }, [payModalCustomer, payAmount, payReference]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Accounts Receivable</h1>
      <p className="mt-1 text-sm text-gray-500">Customer outstanding balances.</p>

      {receivables.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No outstanding balances" description="All customer accounts are settled." />
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Phone</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Due Balance</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Unpaid Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {receivables.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{r.customerName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{r.phone ?? "\u2014"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-red-600">{formatCurrency(r.dueBalance)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">{r.unpaidOrders}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button onClick={() => setPayModalCustomer(r)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                          Pay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">Total Due</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-red-600">{formatCurrency(totalDue)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="mt-6 space-y-3 md:hidden">
            {receivables.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.customerName}</p>
                    <p className="text-xs text-gray-500">{r.phone ?? "No phone"} &middot; {r.unpaidOrders} unpaid orders</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-red-600">{formatCurrency(r.dueBalance)}</p>
                    <button onClick={() => setPayModalCustomer(r)} className="text-xs text-indigo-600 mt-1">Pay</button>
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
              <p className="text-sm font-bold text-gray-900">Total Due: <span className="text-red-600">{formatCurrency(totalDue)}</span></p>
            </div>
          </div>
        </>
      )}

      {/* Pay Modal */}
      <Modal open={!!payModalCustomer} onClose={() => setPayModalCustomer(null)} title="Record Payment">
        <div className="space-y-4">
          {payModalCustomer && (
            <p className="text-sm text-gray-600">
              Recording payment for <strong>{payModalCustomer.customerName}</strong>. Outstanding: {formatCurrency(payModalCustomer.dueBalance)}
            </p>
          )}
          <div>
            <label htmlFor="payAmount" className="block text-sm font-medium text-gray-700">Amount</label>
            <input
              id="payAmount"
              type="number"
              step="0.01"
              min="0"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="payRef" className="block text-sm font-medium text-gray-700">Reference</label>
            <input
              id="payRef"
              type="text"
              value={payReference}
              onChange={(e) => setPayReference(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              placeholder="e.g. Cash, Bank Transfer"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setPayModalCustomer(null)} className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
            <button onClick={handlePay} disabled={paying || !payAmount} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {paying ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
