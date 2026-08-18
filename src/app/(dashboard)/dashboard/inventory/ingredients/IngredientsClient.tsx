"use client";

import { useState, useCallback } from "react";
import {
  getIngredients,
  createIngredient,
  updateIngredient,
  adjustStock,
} from "@/app/actions/inventory";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { formatCurrency } from "@/lib/utils";
import type { Ingredient } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

interface Props {
  initialIngredients: Ingredient[];
  userRole: Role;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface CreateForm {
  name: string;
  unit: string;
  currentStock: string;
  lowStockThreshold: string;
  costPerUnit: string;
}

interface EditForm {
  name: string;
  unit: string;
  lowStockThreshold: string;
  costPerUnit: string;
  active: boolean;
}

interface AdjustForm {
  type: "ADJUSTMENT" | "WASTE";
  quantity: string;
  notes: string;
}

const emptyCreateForm: CreateForm = {
  name: "",
  unit: "",
  currentStock: "0",
  lowStockThreshold: "0",
  costPerUnit: "0",
};

const emptyEditForm: EditForm = {
  name: "",
  unit: "",
  lowStockThreshold: "0",
  costPerUnit: "0",
  active: true,
};

const emptyAdjustForm: AdjustForm = {
  type: "ADJUSTMENT",
  quantity: "",
  notes: "",
};

function getStockColor(currentStock: number, threshold: number): string {
  if (currentStock <= 0) return "text-red-600";
  if (currentStock <= threshold) return "text-yellow-600";
  return "text-green-600";
}

function getStockBg(currentStock: number, threshold: number): string {
  if (currentStock <= 0) return "bg-red-100 text-red-800";
  if (currentStock <= threshold) return "bg-yellow-100 text-yellow-800";
  return "bg-green-100 text-green-800";
}

export default function IngredientsClient({
  initialIngredients,
  userRole,
}: Props) {
  const [ingredients, setIngredients] =
    useState<Ingredient[]>(initialIngredients);
  const [searchQuery, setSearchQuery] = useState("");
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<Ingredient | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);
  const [adjustForm, setAdjustForm] = useState<AdjustForm>(emptyAdjustForm);

  const canManage = userRole === "ADMIN" || userRole === "MANAGER";

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const refetch = useCallback(async () => {
    const result = await getIngredients({
      search: searchQuery || undefined,
      lowStock: lowStockFilter || undefined,
    });
    setIngredients(result.data?.ingredients ?? []);
  }, [searchQuery, lowStockFilter]);

  const handleSearch = useCallback(
    async (value: string) => {
      setSearchQuery(value);
      const result = await getIngredients({
        search: value || undefined,
        lowStock: lowStockFilter || undefined,
      });
      setIngredients(result.data?.ingredients ?? []);
    },
    [lowStockFilter]
  );

  const handleLowStockToggle = async () => {
    const next = !lowStockFilter;
    setLowStockFilter(next);
    const result = await getIngredients({
      search: searchQuery || undefined,
      lowStock: next || undefined,
    });
    setIngredients(result.data?.ingredients ?? []);
  };

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const result = await createIngredient({
        name: createForm.name,
        unit: createForm.unit,
        currentStock: parseFloat(createForm.currentStock) || 0,
        lowStockThreshold: parseFloat(createForm.lowStockThreshold) || 0,
        costPerUnit: parseFloat(createForm.costPerUnit) || 0,
      });
      if (result.success) {
        await refetch();
        showToast("Ingredient created", "success");
        setCreateModalOpen(false);
        setCreateForm(emptyCreateForm);
      } else {
        showToast(result.error ?? "Failed to create", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingItem) return;
    setSubmitting(true);
    try {
      const result = await updateIngredient(editingItem.id, {
        name: editForm.name,
        unit: editForm.unit,
        lowStockThreshold: parseFloat(editForm.lowStockThreshold) || 0,
        costPerUnit: parseFloat(editForm.costPerUnit) || 0,
        active: editForm.active,
      });
      if (result.success) {
        await refetch();
        showToast("Ingredient updated", "success");
        setEditModalOpen(false);
      } else {
        showToast(result.error ?? "Failed to update", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjust = async () => {
    if (!adjustingItem) return;
    const qty = parseFloat(adjustForm.quantity);
    if (!qty || qty <= 0) {
      showToast("Quantity must be positive", "error");
      return;
    }
    setSubmitting(true);
    try {
      const result = await adjustStock(adjustingItem.id, {
        type: adjustForm.type,
        quantity: qty,
        notes: adjustForm.notes || undefined,
      });
      if (result.success) {
        await refetch();
        showToast("Stock adjusted", "success");
        setAdjustModalOpen(false);
        setAdjustForm(emptyAdjustForm);
      } else {
        showToast(result.error ?? "Failed to adjust stock", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (item: Ingredient) => {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold.toString(),
      costPerUnit: item.costPerUnit.toString(),
      active: item.active,
    });
    setEditModalOpen(true);
  };

  const openAdjust = (item: Ingredient) => {
    setAdjustingItem(item);
    setAdjustForm(emptyAdjustForm);
    setAdjustModalOpen(true);
  };

  const toastClass =
    "fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg " +
    (toast?.type === "success" ? "bg-green-600" : "bg-red-600");

  return (
    <div>
      {toast && <div className={toastClass}>{toast.message}</div>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingredients</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your ingredients, stock levels, and pricing.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setCreateForm(emptyCreateForm);
              setCreateModalOpen(true);
            }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add Ingredient
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:w-64">
          <SearchInput
            placeholder="Search ingredients..."
            onSearch={handleSearch}
          />
        </div>
        <button
          onClick={handleLowStockToggle}
          className={
            "rounded-md border px-4 py-2 text-sm font-medium " +
            (lowStockFilter
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")
          }
        >
          Low Stock Only
        </button>
      </div>

      {initialIngredients.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No ingredients yet"
            description="Add your first ingredient to get started."
            action={
              canManage ? (
                <button
                  onClick={() => {
                    setCreateForm(emptyCreateForm);
                    setCreateModalOpen(true);
                  }}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Add Ingredient
                </button>
              ) : undefined
            }
          />
        </div>
      ) : ingredients.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No ingredients match your filters"
            description="Try adjusting your search or filter."
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
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Current Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Cost/Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {ingredients.map((item) => {
                  const stock = Number(item.currentStock);
                  const threshold = Number(item.lowStockThreshold);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {item.unit}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span
                          className={
                            "font-medium " + getStockColor(stock, threshold)
                          }
                        >
                          {item.currentStock.toString()}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatCurrency(Number(item.costPerUnit))}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={
                            "inline-flex rounded-full px-2 text-xs font-semibold leading-5 " +
                            (item.active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600")
                          }
                        >
                          {item.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        {canManage && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(item)}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              title="Edit"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => openAdjust(item)}
                              className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                              title="Adjust Stock"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-6 space-y-3 md:hidden">
            {ingredients.map((item) => {
              const stock = Number(item.currentStock);
              const threshold = Number(item.lowStockThreshold);
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-medium text-gray-900">
                        {item.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {item.unit}
                        {" \u2022 "}
                        {formatCurrency(Number(item.costPerUnit))}/unit
                      </p>
                    </div>
                    <span
                      className={
                        "ml-2 inline-flex shrink-0 rounded-full px-2 text-xs font-semibold leading-5 " +
                        getStockBg(stock, threshold)
                      }
                    >
                      {item.currentStock.toString()} {item.unit}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={
                        "inline-flex rounded-full px-2 text-xs font-semibold leading-5 " +
                        (item.active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600")
                      }
                    >
                      {item.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {canManage && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => openEdit(item)}
                        className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openAdjust(item)}
                        className="rounded border border-blue-300 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        Adjust Stock
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Ingredient"
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="cr-name"
              className="block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <input
              id="cr-name"
              type="text"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, name: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Coffee Beans"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cr-unit"
                className="block text-sm font-medium text-gray-700"
              >
                Unit
              </label>
              <input
                id="cr-unit"
                type="text"
                value={createForm.unit}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, unit: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. kg"
              />
            </div>
            <div>
              <label
                htmlFor="cr-stock"
                className="block text-sm font-medium text-gray-700"
              >
                Current Stock
              </label>
              <input
                id="cr-stock"
                type="number"
                min={0}
                step={0.001}
                value={createForm.currentStock}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    currentStock: e.target.value,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cr-threshold"
                className="block text-sm font-medium text-gray-700"
              >
                Low Stock Threshold
              </label>
              <input
                id="cr-threshold"
                type="number"
                min={0}
                step={0.001}
                value={createForm.lowStockThreshold}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    lowStockThreshold: e.target.value,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label
                htmlFor="cr-cost"
                className="block text-sm font-medium text-gray-700"
              >
                Cost Per Unit
              </label>
              <input
                id="cr-cost"
                type="number"
                min={0}
                step={0.01}
                value={createForm.costPerUnit}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    costPerUnit: e.target.value,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setCreateModalOpen(false)}
            disabled={submitting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={
              submitting || !createForm.name.trim() || !createForm.unit.trim()
            }
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Create"}
          </button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Ingredient"
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="ed-name"
              className="block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <input
              id="ed-name"
              type="text"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, name: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="ed-unit"
                className="block text-sm font-medium text-gray-700"
              >
                Unit
              </label>
              <input
                id="ed-unit"
                type="text"
                value={editForm.unit}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, unit: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label
                htmlFor="ed-cost"
                className="block text-sm font-medium text-gray-700"
              >
                Cost Per Unit
              </label>
              <input
                id="ed-cost"
                type="number"
                min={0}
                step={0.01}
                value={editForm.costPerUnit}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    costPerUnit: e.target.value,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="ed-threshold"
                className="block text-sm font-medium text-gray-700"
              >
                Low Stock Threshold
              </label>
              <input
                id="ed-threshold"
                type="number"
                min={0}
                step={0.001}
                value={editForm.lowStockThreshold}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    lowStockThreshold: e.target.value,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <input
                  id="ed-active"
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      active: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="ed-active" className="text-sm text-gray-700">
                  Active
                </label>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            To adjust stock quantity, use the &quot;Adjust Stock&quot; action from the list.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setEditModalOpen(false)}
            disabled={submitting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleEdit}
            disabled={submitting || !editForm.name.trim() || !editForm.unit.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        open={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title={
          "Adjust Stock \u2014 " + (adjustingItem?.name ?? "")
        }
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="adj-type"
              className="block text-sm font-medium text-gray-700"
            >
              Type
            </label>
            <select
              id="adj-type"
              value={adjustForm.type}
              onChange={(e) =>
                setAdjustForm((f) => ({
                  ...f,
                  type: e.target.value as "ADJUSTMENT" | "WASTE",
                }))
              }
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ADJUSTMENT">Adjustment (Add/Remove)</option>
              <option value="WASTE">Waste (Discard)</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="adj-qty"
              className="block text-sm font-medium text-gray-700"
            >
              Quantity
            </label>
            <input
              id="adj-qty"
              type="number"
              min={0.001}
              step={0.001}
              value={adjustForm.quantity}
              onChange={(e) =>
                setAdjustForm((f) => ({ ...f, quantity: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder={
                adjustForm.type === "ADJUSTMENT"
                  ? "Positive to add, will be added"
                  : "Quantity to discard"
              }
            />
            {adjustForm.type === "ADJUSTMENT" && (
              <p className="mt-1 text-xs text-gray-500">
                For adjustments, stock will be increased by this quantity.
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="adj-notes"
              className="block text-sm font-medium text-gray-700"
            >
              Notes
            </label>
            <textarea
              id="adj-notes"
              rows={2}
              value={adjustForm.notes}
              onChange={(e) =>
                setAdjustForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setAdjustModalOpen(false)}
            disabled={submitting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAdjust}
            disabled={submitting || !adjustForm.quantity}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Apply Adjustment"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
