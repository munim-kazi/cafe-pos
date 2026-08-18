"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { createIngredient } from "@/app/actions/inventory";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";
import type { Ingredient } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

interface Props {
  ingredients: Ingredient[];
  lowStockItems: Ingredient[];
  userRole: Role;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface FormState {
  name: string;
  unit: string;
  currentStock: string;
  lowStockThreshold: string;
  costPerUnit: string;
}

const emptyForm: FormState = {
  name: "",
  unit: "",
  currentStock: "0",
  lowStockThreshold: "0",
  costPerUnit: "0",
};

export default function InventoryDashboard({
  ingredients,
  lowStockItems,
  userRole,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const canManage = userRole === "ADMIN" || userRole === "MANAGER";

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const totalValue = ingredients.reduce(
    (sum, i) => sum + Number(i.currentStock) * Number(i.costPerUnit),
    0
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await createIngredient({
        name: form.name,
        unit: form.unit,
        currentStock: parseFloat(form.currentStock) || 0,
        lowStockThreshold: parseFloat(form.lowStockThreshold) || 0,
        costPerUnit: parseFloat(form.costPerUnit) || 0,
      });
      if (result.success) {
        showToast("Ingredient created", "success");
        setModalOpen(false);
        setForm(emptyForm);
      } else {
        showToast(result.error ?? "Failed to create ingredient", "error");
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of ingredients, stock levels, and recipes.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setForm(emptyForm);
              setModalOpen(true);
            }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add Ingredient
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Total Ingredients</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {ingredients.length}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {lowStockItems.length}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Inventory Value</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatCurrency(totalValue)}
          </p>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Low Stock Alerts
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lowStockItems.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-red-200 bg-red-50 p-4"
              >
                <h3 className="text-sm font-medium text-red-900">{item.name}</h3>
                <p className="mt-1 text-xs text-red-700">
                  {item.currentStock.toString()} {item.unit} remaining
                  {" \u2014 "}
                  threshold: {item.lowStockThreshold.toString()} {item.unit}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Cards */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Quick Access</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/dashboard/inventory/ingredients"
            className="rounded-lg border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-colors"
          >
            <h3 className="text-sm font-semibold text-gray-900">
              Ingredients
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Manage ingredients and stock levels.
            </p>
          </Link>
          <Link
            href="/dashboard/inventory/recipes"
            className="rounded-lg border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-colors"
          >
            <h3 className="text-sm font-semibold text-gray-900">Recipes</h3>
            <p className="mt-1 text-xs text-gray-500">
              Assign ingredients to menu items.
            </p>
          </Link>
          <Link
            href="/dashboard/inventory/purchases"
            className="rounded-lg border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-colors"
          >
            <h3 className="text-sm font-semibold text-gray-900">Purchases</h3>
            <p className="mt-1 text-xs text-gray-500">
              Track purchase orders and suppliers.
            </p>
          </Link>
          <Link
            href="/dashboard/inventory/suppliers"
            className="rounded-lg border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-colors"
          >
            <h3 className="text-sm font-semibold text-gray-900">
              Supplier Payments
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Manage supplier balances and payments.
            </p>
          </Link>
        </div>
      </div>

      {/* Add Ingredient Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Ingredient"
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="ing-name"
              className="block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <input
              id="ing-name"
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Coffee Beans"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="ing-unit"
                className="block text-sm font-medium text-gray-700"
              >
                Unit
              </label>
              <input
                id="ing-unit"
                type="text"
                value={form.unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unit: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. kg"
              />
            </div>
            <div>
              <label
                htmlFor="ing-stock"
                className="block text-sm font-medium text-gray-700"
              >
                Initial Stock
              </label>
              <input
                id="ing-stock"
                type="number"
                min={0}
                step={0.001}
                value={form.currentStock}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currentStock: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="ing-threshold"
                className="block text-sm font-medium text-gray-700"
              >
                Low Stock Threshold
              </label>
              <input
                id="ing-threshold"
                type="number"
                min={0}
                step={0.001}
                value={form.lowStockThreshold}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    lowStockThreshold: e.target.value,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label
                htmlFor="ing-cost"
                className="block text-sm font-medium text-gray-700"
              >
                Cost Per Unit
              </label>
              <input
                id="ing-cost"
                type="number"
                min={0}
                step={0.01}
                value={form.costPerUnit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, costPerUnit: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
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
            onClick={handleSubmit}
            disabled={submitting || !form.name.trim() || !form.unit.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Create"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
