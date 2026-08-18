"use client";

import { useState, useCallback } from "react";
import { getSupplierPayments, processSupplierPayment } from "@/app/actions/purchases";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import type { Supplier } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

type SupplierWithPurchases = Supplier & {
  purchases: {
    id: string;
    purchaseNumber: string;
    total: unknown;
    paidAmount: unknown;
    date: Date;
  }[];
};

interface Props {
  supplierPayments: SupplierWithPurchases[];
  userRole: Role;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

export default function SupplierPaymentsClient({
  supplierPayments,
  userRole,
}: Props) {
  const [payments, setPayments] = useState<SupplierWithPurchases[]>(supplierPayments);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithPurchases | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const canPay = userRole === "ADMIN" || userRole === "MANAGER";

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const openPayModal = (supplier: SupplierWithPurchases) => {
    setSelectedSupplier(supplier);
    setAmount("");
    setReference("");
    setModalOpen(true);
  };

  const handlePay = async () => {
    if (!selectedSupplier || !amount) return;
    const payAmount = Number(amount);
    if (payAmount <= 0) {
      showToast("Amount must be positive", "error");
      return;
    }

    setSubmitting(true);
    try {
      const result = await processSupplierPayment(selectedSupplier.id, {
        amount: payAmount,
        reference: reference || undefined,
      });

      if (result.success) {
        showToast("Payment processed successfully", "success");
        setModalOpen(false);
        setSelectedSupplier(null);
        const updated = await getSupplierPayments();
        setPayments(updated.data?.items ?? []);
      } else {
        showToast(result.error ?? "Failed to process payment", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getDueBalance = (supplier: SupplierWithPurchases) => {
    const num =
      typeof supplier.dueBalance === "number"
        ? supplier.dueBalance
        : parseFloat(String(supplier.dueBalance ?? 0));
    return num;
  };

  const toastClass =
    "fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg " +
    (toast?.type === "success" ? "bg-green-600" : "bg-red-600");

  return (
    <div>
      {toast && <div className={toastClass}>{toast.message}</div>}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Supplier Payments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage outstanding supplier balances and process payments.
        </p>
      </div>

      {payments.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No outstanding balances"
            description="All supplier balances are settled."
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Company
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Due Balance
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Outstanding Purchases
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {payments.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {supplier.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {supplier.company ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-red-600">
                      {formatCurrency(getDueBalance(supplier))}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500">
                      {supplier.purchases.length}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      {canPay && (
                        <button
                          onClick={() => openPayModal(supplier)}
                          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                        >
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-6 space-y-3 md:hidden">
            {payments.map((supplier) => (
              <div key={supplier.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-gray-900">
                      {supplier.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {supplier.company ?? "\u2014"}
                      {" \u2022 "}{supplier.purchases.length} outstanding
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-red-600">
                      {formatCurrency(getDueBalance(supplier))}
                    </p>
                    {canPay && (
                      <button
                        onClick={() => openPayModal(supplier)}
                        className="mt-1 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        Pay
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Payment Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Process Supplier Payment"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Supplier</label>
            <p className="mt-1 text-sm text-gray-900">{selectedSupplier?.name ?? ""}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Due Balance</label>
            <p className="mt-1 text-sm font-medium text-red-600">
              {selectedSupplier ? formatCurrency(getDueBalance(selectedSupplier)) : ""}
            </p>
          </div>
          <div>
            <label htmlFor="pay-amount" className="block text-sm font-medium text-gray-700">
              Payment Amount
            </label>
            <input
              id="pay-amount"
              type="number"
              min="0"
              max={selectedSupplier ? getDueBalance(selectedSupplier) : 0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="pay-ref" className="block text-sm font-medium text-gray-700">
              Reference (optional)
            </label>
            <input
              id="pay-ref"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Bank transfer ref"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setModalOpen(false)}
            disabled={submitting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={submitting || !amount || Number(amount) <= 0}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Processing..." : "Process Payment"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
