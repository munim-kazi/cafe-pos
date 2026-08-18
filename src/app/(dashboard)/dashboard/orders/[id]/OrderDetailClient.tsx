"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { processPayment, cancelOrder } from "@/app/actions/orders";
import { formatCurrency, cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import type { Role } from "@/generated/prisma/enums";

interface AddonItem {
  id: string;
  addonId: string;
  name: string;
  price: { toString(): string };
}

interface OrderItemFull {
  id: string;
  menuItemId: string;
  variantId: string | null;
  name: string;
  quantity: number;
  unitPrice: { toString(): string };
  discount: { toString(): string };
  subtotal: { toString(): string };
  addons: AddonItem[];
}

interface PaymentRecord {
  id: string;
  method: string;
  amount: { toString(): string };
  reference: string | null;
  createdAt: Date | string;
}

interface OrderFull {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  paymentStatus: string;
  subtotal: { toString(): string };
  discountAmount: { toString(): string };
  taxRate: { toString(): string };
  taxAmount: { toString(): string };
  grandTotal: { toString(): string };
  notes: string | null;
  createdAt: Date | string;
  table: { id: string; number: number; capacity: number; status: string; section: string | null } | null;
  customer: { id: string; name: string; phone: string | null; dueBalance: { toString(): string } } | null;
  items: OrderItemFull[];
  createdBy: { id: string; name: string | null; role: Role };
  payments: PaymentRecord[];
  kots: { id: string; kotNumber: number; status: string; createdAt: Date | string }[];
}

interface Props {
  order: OrderFull;
  userRole: Role;
}

const PAYMENT_METHODS = [
  { label: "Cash", value: "CASH" },
  { label: "Card", value: "CARD" },
  { label: "Mobile", value: "MOBILE" },
  { label: "Bank Transfer", value: "BANK_TRANSFER" },
];

const QUICK_CASH = [100, 200, 500, 1000];

function statusColor(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-800";
    case "CONFIRMED":
      return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS":
      return "bg-orange-100 text-orange-800";
    case "READY":
      return "bg-green-100 text-green-800";
    case "SERVED":
      return "bg-green-100 text-green-800";
    case "COMPLETED":
      return "bg-gray-100 text-gray-600";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function typeColor(type: string): string {
  switch (type) {
    case "DINE_IN":
      return "bg-blue-100 text-blue-800";
    case "TAKEAWAY":
      return "bg-purple-100 text-purple-800";
    case "DELIVERY":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function OrderDetailClient({ order, userRole }: Props) {
  const router = useRouter();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "MOBILE" | "BANK_TRANSFER">("CASH");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const grandTotal = Number(order.grandTotal.toString());
  const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount.toString()), 0);
  const remaining = grandTotal - totalPaid;

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const canCancel = (userRole === "ADMIN" || userRole === "MANAGER") &&
    (order.status === "PENDING" || order.status === "CONFIRMED");

  const canPay = order.paymentStatus !== "PAID" && order.status !== "CANCELLED";

  const getNextStatus = (): string | null => {
    if (order.status === "CONFIRMED" && (userRole === "MANAGER" || userRole === "ADMIN")) {
      return "IN_PROGRESS";
    }
    if (order.status === "IN_PROGRESS" && userRole === "KITCHEN") {
      return "READY";
    }
    if (order.status === "READY" && userRole === "CASHIER") {
      return "SERVED";
    }
    return null;
  };

  const nextStatus = getNextStatus();

  const handlePayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }
    setProcessingPayment(true);
    try {
      const result = await processPayment({
        orderId: order.id,
        method: paymentMethod,
        amount,
        reference: paymentReference || undefined,
      });
      if (result.success) {
        showToast("Payment processed successfully", "success");
        setPaymentModalOpen(false);
        setPaymentAmount("");
        setPaymentReference("");
        router.refresh();
      } else {
        showToast(result.error ?? "Failed to process payment", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      showToast("Cancellation reason is required", "error");
      return;
    }
    setCancelling(true);
    try {
      const result = await cancelOrder(order.id, cancelReason.trim());
      if (result.success) {
        showToast("Order cancelled", "success");
        setCancelConfirmOpen(false);
        setCancelReason("");
        router.refresh();
      } else {
        showToast(result.error ?? "Failed to cancel order", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setCancelling(false);
    }
  };

  const openPaymentModal = () => {
    setPaymentMethod("CASH");
    setPaymentAmount(remaining > 0 ? remaining.toFixed(2) : grandTotal.toFixed(2));
    setPaymentReference("");
    setPaymentModalOpen(true);
  };

  const toastClass =
    "fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg " +
    (toast?.type === "success" ? "bg-green-600" : "bg-red-600");

  return (
    <div>
      {toast && <div className={toastClass}>{toast.message}</div>}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            onClick={() => router.push("/dashboard/orders")}
            className="mb-2 text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to Orders
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + typeColor(order.type)}>
              {order.type.replace("_", " ")}
            </span>
            <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + statusColor(order.status)}>
              {order.status.replace("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Created by {order.createdBy.name ?? "Unknown"} on{" "}
            {new Date(order.createdAt).toLocaleString("en-BD")}
          </p>
          {order.table && (
            <p className="text-sm text-gray-500">
              Table #{order.table.number} ({order.table.section ?? "N/A"}, {order.table.capacity} seats)
            </p>
          )}
          {order.customer && (
            <p className="text-sm text-gray-500">
              Customer: {order.customer.name}
              {order.customer.phone ? " (" + order.customer.phone + ")" : ""}
            </p>
          )}
          {order.notes && (
            <p className="mt-1 text-sm text-gray-600 italic">Notes: {order.notes}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {nextStatus && (
            <button
              onClick={() => {}}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Mark as {nextStatus.replace("_", " ").toLowerCase()}
            </button>
          )}
          {canPay && (
            <button
              onClick={openPaymentModal}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Accept Payment
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setCancelConfirmOpen(true)}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Cancel Order
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Print Receipt
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="mt-8 overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Item
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Variant
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Qty
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Unit Price
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Addons
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {item.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {item.variantId ? "\u2014" : "\u2014"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500">
                  {item.quantity}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-500">
                  {formatCurrency(Number(item.unitPrice.toString()))}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {item.addons.length > 0
                    ? item.addons.map((a) => a.name + " (" + formatCurrency(Number(a.price.toString())) + ")").join(", ")
                    : "\u2014"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                  {formatCurrency(Number(item.subtotal.toString()))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-sm space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(Number(order.subtotal.toString()))}</span>
          </div>
          {Number(order.discountAmount.toString()) > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Discount</span>
              <span className="text-red-600">-{formatCurrency(Number(order.discountAmount.toString()))}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tax ({Number(order.taxRate.toString())}%)</span>
            <span>{formatCurrency(Number(order.taxAmount.toString()))}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
            <span>Grand Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Payments */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
        {order.payments.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No payments recorded yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Method
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {order.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {payment.method.replace("_", " ")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(Number(payment.amount.toString()))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {payment.reference ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {new Date(payment.createdAt).toLocaleString("en-BD")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-6 text-sm">
          <div className="text-gray-600">
            Total Paid: <span className="font-medium text-gray-900">{formatCurrency(totalPaid)}</span>
          </div>
          <div className="text-gray-600">
            Remaining:{" "}
            <span className={cn("font-medium", remaining > 0 ? "text-red-600" : "text-green-600")}>
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Accept Payment"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Method</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value as typeof paymentMethod)}
                  className={
                    "rounded-md border px-4 py-2 text-sm font-medium transition-colors " +
                    (paymentMethod === m.value
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50")
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Amount (Remaining: {formatCurrency(remaining)})
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_CASH.map((amount) => (
              <button
                key={amount}
                onClick={() => setPaymentAmount(amount.toFixed(2))}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {formatCurrency(amount)}
              </button>
            ))}
            {remaining > 0 && (
              <button
                onClick={() => setPaymentAmount(remaining.toFixed(2))}
                className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                Exact ({formatCurrency(remaining)})
              </button>
            )}
          </div>
          {(paymentMethod === "CARD" || paymentMethod === "MOBILE" || paymentMethod === "BANK_TRANSFER") && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Reference / Transaction ID</label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Optional"
              />
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setPaymentModalOpen(false)}
            disabled={processingPayment}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={processingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {processingPayment ? "Processing..." : "Process Payment"}
          </button>
        </div>
      </Modal>

      {/* Cancel Confirmation */}
      <Modal
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="Cancel Order"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to cancel order <strong>{order.orderNumber}</strong>? This action cannot be undone.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reason (required)</label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Enter cancellation reason..."
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setCancelConfirmOpen(false)}
            disabled={cancelling}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Keep Order
          </button>
          <button
            onClick={handleCancel}
            disabled={cancelling || !cancelReason.trim()}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {cancelling ? "Cancelling..." : "Cancel Order"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
