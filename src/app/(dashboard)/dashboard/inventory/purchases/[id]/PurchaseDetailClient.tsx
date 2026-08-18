"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { receivePurchase, cancelPurchase } from "@/app/actions/purchases";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Purchase, Supplier, PurchaseItem } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

type PurchaseFull = Purchase & {
  supplier: Supplier;
  createdBy: { id: string; name: string; role: Role };
  items: (PurchaseItem & {
    ingredient: { id: string; name: string; unit: string; currentStock: unknown };
  })[];
};

interface Props {
  purchase: PurchaseFull;
  userRole: Role;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  RECEIVED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function PurchaseDetailClient({ purchase, userRole }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const canManage = userRole === "ADMIN" || userRole === "MANAGER";
  const isDraft = purchase.status === "DRAFT";

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleReceive = async () => {
    setActionLoading(true);
    try {
      const result = await receivePurchase(purchase.id);
      if (result.success) {
        showToast("Purchase received successfully", "success");
        setTimeout(() => router.refresh(), 1000);
      } else {
        showToast(result.error ?? "Failed to receive purchase", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      const result = await cancelPurchase(purchase.id);
      if (result.success) {
        showToast("Purchase cancelled", "success");
        setCancelConfirmOpen(false);
        setTimeout(() => router.refresh(), 1000);
      } else {
        showToast(result.error ?? "Failed to cancel purchase", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const subtotal = Number(purchase.subtotal);
  const total = Number(purchase.total);
  const paidAmount = Number(purchase.paidAmount);
  const dueAmount = total - paidAmount;

  const toastClass =
    "fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg " +
    (toast?.type === "success" ? "bg-green-600" : "bg-red-600");

  return (
    <div>
      {toast && <div className={toastClass}>{toast.message}</div>}

      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/inventory/purchases")}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{purchase.purchaseNumber}</h1>
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                STATUS_BADGE[purchase.status] ?? "bg-gray-100 text-gray-800"
              )}
            >
              {purchase.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {purchase.supplier.name}
            {purchase.supplier.company ? " (" + purchase.supplier.company + ")" : ""}
            {" \u2022 "}{formatDate(purchase.date)}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Print
          </button>
          {canManage && isDraft && (
            <>
              <button
                onClick={handleReceive}
                disabled={actionLoading}
                className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Receive"}
              </button>
              <button
                onClick={() => setCancelConfirmOpen(true)}
                disabled={actionLoading}
                className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Cancel Purchase
              </button>
            </>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Ingredient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Unit
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Quantity
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Unit Cost
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {purchase.items.map((item) => (
              <tr key={item.id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {item.ingredient.name}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {item.ingredient.unit}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                  {Number(item.quantity)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                  {formatCurrency(Number(item.unitCost))}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                  {formatCurrency(Number(item.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-sm space-y-2 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-sm">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="font-semibold text-gray-900">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Paid Amount</span>
            <span className="font-medium text-gray-900">{formatCurrency(paidAmount)}</span>
          </div>
          {purchase.isCredit && dueAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Due Amount</span>
              <span className="font-medium text-red-600">{formatCurrency(dueAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-sm">
            <span className="text-gray-500">Payment Type</span>
            <span className="font-medium text-gray-900">
              {purchase.isCredit ? "Credit" : "Cash"}
            </span>
          </div>
          {purchase.notes && (
            <div className="border-t border-gray-200 pt-2">
              <p className="text-xs text-gray-500">Notes</p>
              <p className="mt-1 text-sm text-gray-700">{purchase.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Created by */}
      <div className="mt-4 text-right text-xs text-gray-400">
        Created by {purchase.createdBy.name} on {formatDate(purchase.createdAt)}
      </div>

      <ConfirmDialog
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Purchase"
        message={
          "Are you sure you want to cancel " +
          purchase.purchaseNumber +
          "? This action cannot be undone."
        }
        confirmLabel="Cancel Purchase"
        loading={actionLoading}
      />
    </div>
  );
}
