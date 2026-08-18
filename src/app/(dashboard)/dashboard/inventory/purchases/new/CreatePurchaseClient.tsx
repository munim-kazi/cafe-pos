"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPurchase } from "@/app/actions/purchases";
import { formatCurrency } from "@/lib/utils";
import type { Supplier, Ingredient } from "@/generated/prisma/client";

interface Props {
  suppliers: Supplier[];
  ingredients: Ingredient[];
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface PurchaseItemRow {
  ingredientId: string;
  quantity: string;
  unitCost: string;
}

const emptyRow: PurchaseItemRow = {
  ingredientId: "",
  quantity: "",
  unitCost: "",
};

export default function CreatePurchaseClient({ suppliers, ingredients }: Props) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<PurchaseItemRow[]>([{ ...emptyRow }]);
  const [isCredit, setIsCredit] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const updateItem = (index: number, field: keyof PurchaseItemRow, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...emptyRow }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const getSubtotal = () => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const cost = Number(item.unitCost) || 0;
      return sum + qty * cost;
    }, 0);
  };

  const getTotal = () => getSubtotal();

  const getDueAmount = () => {
    if (!isCredit) return 0;
    const total = getTotal();
    const paid = Number(paidAmount) || 0;
    return Math.max(0, total - paid);
  };

  const handleCreditToggle = () => {
    const newCredit = !isCredit;
    setIsCredit(newCredit);
    if (!newCredit) {
      setPaidAmount("");
    } else {
      setPaidAmount(String(getTotal()));
    }
  };

  const isFormValid = () => {
    if (!supplierId) return false;
    const validItems = items.filter(
      (item) => item.ingredientId && Number(item.quantity) > 0 && Number(item.unitCost) > 0
    );
    if (validItems.length === 0) return false;
    if (isCredit) {
      const paid = Number(paidAmount) || 0;
      if (paid < 0) return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;
    setSubmitting(true);
    try {
      const validItems = items
        .filter(
          (item) =>
            item.ingredientId && Number(item.quantity) > 0 && Number(item.unitCost) > 0
        )
        .map((item) => ({
          ingredientId: item.ingredientId,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
        }));

      const result = await createPurchase({
        supplierId,
        items: validItems,
        isCredit,
        paidAmount: isCredit ? Number(paidAmount) || 0 : undefined,
        notes: notes || undefined,
      });

      if (result.success) {
        showToast("Purchase created successfully", "success");
        setTimeout(() => router.push("/dashboard/inventory/purchases"), 1000);
      } else {
        showToast(result.error ?? "Failed to create purchase", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Purchase</h1>
          <p className="mt-1 text-sm text-gray-500">Add a new inventory purchase order.</p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {/* Supplier */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900">Supplier</h2>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select a supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.company ? " (" + s.company + ")" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Items */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Purchase Items</h2>
            <button
              onClick={addItem}
              className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
            >
              + Add Item
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {/* Desktop header */}
            <div className="hidden gap-4 sm:grid sm:grid-cols-12">
              <div className="col-span-5 text-xs font-medium uppercase tracking-wider text-gray-500">
                Ingredient
              </div>
              <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Quantity
              </div>
              <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Unit Cost
              </div>
              <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Total
              </div>
              <div className="col-span-1" />
            </div>

            {items.map((item, index) => {
              const qty = Number(item.quantity) || 0;
              const cost = Number(item.unitCost) || 0;
              const rowTotal = qty * cost;

              return (
                <div
                  key={index}
                  className="flex flex-col gap-2 rounded-md border border-gray-100 p-3 sm:grid sm:grid-cols-12 sm:items-center sm:border-0 sm:p-0"
                >
                  <div className="sm:col-span-5">
                    <label className="mb-1 text-xs text-gray-500 sm:hidden">Ingredient</label>
                    <select
                      value={item.ingredientId}
                      onChange={(e) => updateItem(index, "ingredientId", e.target.value)}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Select ingredient</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 text-xs text-gray-500 sm:hidden">Quantity</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      placeholder="0"
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 text-xs text-gray-500 sm:hidden">Unit Cost</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.unitCost}
                      onChange={(e) => updateItem(index, "unitCost", e.target.value)}
                      placeholder="0.00"
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 text-xs text-gray-500 sm:hidden">Total</label>
                    <p className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
                      {formatCurrency(rowTotal)}
                    </p>
                  </div>
                  <div className="flex justify-end sm:col-span-1">
                    <button
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end border-t border-gray-200 pt-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Subtotal</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(getSubtotal())}</p>
              <p className="text-sm font-semibold text-gray-900">
                Total: {formatCurrency(getTotal())}
              </p>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900">Payment</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={isCredit}
                  onChange={handleCreditToggle}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
                <span className="text-sm font-medium text-gray-700">Credit Purchase</span>
              </label>
            </div>

            {isCredit && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Paid Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={getTotal()}
                    step="any"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Due Amount
                  </label>
                  <p className="mt-1 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
                    {formatCurrency(getDueAmount())}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900">Notes</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes..."
            className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => router.push("/dashboard/inventory/purchases")}
            disabled={submitting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !isFormValid()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}
