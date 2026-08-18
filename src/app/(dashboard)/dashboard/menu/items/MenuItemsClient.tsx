"use client";

import { useState, useCallback } from "react";
import { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem } from "@/app/actions/menu-items";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import type { MenuItem, Category } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

interface Props {
  initialItems: MenuItem[];
  categories: Category[];
  userRole: Role;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface VariantForm {
  id?: string;
  name: string;
  priceAdjust: number;
  available: boolean;
  addonIds: string[];
}

interface FormState {
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  available: boolean;
  prepTimeMin: string;
  variants: VariantForm[];
}

const emptyForm: FormState = {
  name: "",
  description: "",
  categoryId: "",
  basePrice: 0,
  available: true,
  prepTimeMin: "",
  variants: [],
};

export default function MenuItemsClient({
  initialItems,
  categories,
  userRole,
}: Props) {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");


  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const filterItems = useCallback(
    (allItems: MenuItem[], catId: string, search: string) => {
      let result = allItems;
      if (catId) result = result.filter((i) => i.categoryId === catId);
      if (search) {
        const q = search.toLowerCase();
        result = result.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.description?.toLowerCase().includes(q) ?? false)
        );
      }
      setItems(result);
    },
    []
  );

  const refetchItems = useCallback(async () => {
    const updated = await getMenuItems();
    const all = updated.data ?? [];
    setItems(all);
    return all;
  }, []);

  const handleCategoryFilter = (value: string) => {
    setCategoryFilter(value);
    filterItems(items, value, searchQuery);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    filterItems(items, categoryFilter, value);
  };

  const canCreate = userRole === "ADMIN" || userRole === "MANAGER";
  const canEdit = userRole === "ADMIN";

  const openCreateModal = () => {
    setEditingItem(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? "" });
    setModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    const v = item as Record<string, unknown>;
    const rawVariants = v.variants;
    const variants: VariantForm[] = Array.isArray(rawVariants)
      ? (rawVariants as Record<string, unknown>[]).map((vr) => {
          const addons = vr.addons;
          return {
            id: vr.id as string | undefined,
            name: vr.name as string,
            priceAdjust: Number(vr.priceAdjust),
            available: vr.available as boolean,
            addonIds: Array.isArray(addons)
              ? (addons as Record<string, unknown>[]).map(
                  (a) => (a.addon as Record<string, unknown>)?.id as string ?? ""
                )
              : [],
          };
        })
      : [];
    setForm({
      name: item.name,
      description: item.description ?? "",
      categoryId: item.categoryId,
      basePrice: Number(item.basePrice),
      available: item.available,
      prepTimeMin: item.prepTimeMin?.toString() ?? "",
      variants,
    });
    setModalOpen(true);
  };

  const openDeleteConfirm = (item: MenuItem) => {
    setDeletingItem(item);
    setDeleteConfirmOpen(true);
  };

  const handleVariantChange = (
    index: number,
    field: keyof VariantForm,
    value: string | number | boolean
  ) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      ),
    }));
  };

  const addVariant = () => {
    setForm((f) => ({
      ...f,
      variants: [
        ...f.variants,
        { name: "", priceAdjust: 0, available: true, addonIds: [] },
      ],
    }));
  };

  const removeVariant = (index: number) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        categoryId: form.categoryId,
        basePrice: form.basePrice,
        available: form.available,
        prepTimeMin: form.prepTimeMin
          ? parseInt(form.prepTimeMin, 10)
          : undefined,
        variants: form.variants.map((vr) => ({
          id: vr.id,
          name: vr.name,
          priceAdjust: vr.priceAdjust,
          available: vr.available,
          addonIds: vr.addonIds,
        })),
      };

      if (editingItem) {
        const result = await updateMenuItem(editingItem.id, payload);
        if (result.success) {
          const all = await refetchItems();
          filterItems(all, categoryFilter, searchQuery);
          showToast("Menu item updated", "success");
        } else {
          showToast(result.error ?? "Failed to update", "error");
        }
      } else {
        const result = await createMenuItem(payload);
        if (result.success) {
          const all = await refetchItems();
          filterItems(all, categoryFilter, searchQuery);
          showToast("Menu item created", "success");
        } else {
          showToast(result.error ?? "Failed to create", "error");
        }
      }
      setModalOpen(false);
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    try {
      const result = await deleteMenuItem(deletingItem.id);
      if (result.success) {
        const all = await refetchItems();
        filterItems(all, categoryFilter, searchQuery);
        showToast("Menu item deleted", "success");
      } else {
        showToast(result.error ?? "Failed to delete", "error");
      }
      setDeleteConfirmOpen(false);
      setDeletingItem(null);
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setDeleting(false);
    }
  };

  const getCategoryName = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.name ?? "\u2014";

  const formatPrice = (price: unknown) => {
    const num =
      typeof price === "number" ? price : parseFloat(String(price ?? 0));
    return "$" + num.toFixed(2);
  };

  const getVariantCount = (item: MenuItem) => {
    const v = (item as Record<string, unknown>).variants;
    return Array.isArray(v) ? v.length : 0;
  };

  const toastClass =
    "fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg " +
    (toast?.type === "success" ? "bg-green-600" : "bg-red-600");

  return (
    <div>
      {toast && <div className={toastClass}>{toast.message}</div>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Items</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your menu items, pricing, and variants.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add Item
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:w-64">
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryFilter(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-64">
          <SearchInput placeholder="Search items..." onSearch={handleSearch} />
        </div>
      </div>

      {initialItems.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No menu items yet"
            description="Create your first menu item to get started."
            action={
              canCreate ? (
                <button
                  onClick={openCreateModal}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Add Item
                </button>
              ) : undefined
            }
          />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No items match your filters"
            description="Try adjusting your search or category filter."
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
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Base Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Variants
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
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {getCategoryName(item.categoryId)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatPrice(item.basePrice)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {getVariantCount(item)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={
                          "inline-flex rounded-full px-2 text-xs font-semibold leading-5 " +
                          (item.available
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600")
                        }
                      >
                        {item.available ? "Available" : "Unavailable"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(item)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                            onClick={() => openDeleteConfirm(item)}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-6 space-y-3 md:hidden">
            {items.map((item) => (
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
                      {getCategoryName(item.categoryId)}
                    </p>
                  </div>
                  <span
                    className={
                      "ml-2 inline-flex shrink-0 rounded-full px-2 text-xs font-semibold leading-5 " +
                      (item.available
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600")
                    }
                  >
                    {item.available ? "Available" : "Unavailable"}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                  <span>{formatPrice(item.basePrice)}</span>
                  <span>{getVariantCount(item)} variant(s)</span>
                </div>
                {canEdit && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openEditModal(item)}
                      className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDeleteConfirm(item)}
                      className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Edit Menu Item" : "Add Menu Item"}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div>
            <label
              htmlFor="mi-name"
              className="block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <input
              id="mi-name"
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Cappuccino"
            />
          </div>
          <div>
            <label
              htmlFor="mi-desc"
              className="block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <textarea
              id="mi-desc"
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="mi-category"
                className="block text-sm font-medium text-gray-700"
              >
                Category
              </label>
              <select
                id="mi-category"
                value={form.categoryId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, categoryId: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="mi-price"
                className="block text-sm font-medium text-gray-700"
              >
                Base Price
              </label>
              <input
                id="mi-price"
                type="number"
                min={0}
                step={0.01}
                value={form.basePrice}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    basePrice: parseFloat(e.target.value) || 0,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="mi-prep"
                className="block text-sm font-medium text-gray-700"
              >
                Prep Time (min)
              </label>
              <input
                id="mi-prep"
                type="number"
                min={0}
                value={form.prepTimeMin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, prepTimeMin: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Optional"
              />
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <input
                  id="mi-available"
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, available: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="mi-available" className="text-sm text-gray-700">
                  Available
                </label>
              </div>
            </div>
          </div>

          {/* Variants section */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">Variants</h3>
              <button
                type="button"
                onClick={addVariant}
                className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                + Add Variant
              </button>
            </div>
            {form.variants.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">
                No variants. Add one if this item has size/color options.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {form.variants.map((variant, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-md border border-gray-200 p-3"
                  >
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={variant.name}
                        onChange={(e) =>
                          handleVariantChange(idx, "name", e.target.value)
                        }
                        placeholder="Variant name (e.g. Large)"
                        className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <input
                        type="number"
                        value={variant.priceAdjust}
                        onChange={(e) =>
                          handleVariantChange(
                            idx,
                            "priceAdjust",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        step={0.01}
                        placeholder="Price adjustment"
                        className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={variant.available}
                          onChange={(e) =>
                            handleVariantChange(
                              idx,
                              "available",
                              e.target.checked
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-gray-600">
                          Available
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVariant(idx)}
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            disabled={submitting || !form.name.trim() || !form.categoryId}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting
              ? "Saving..."
              : editingItem
                ? "Save Changes"
                : "Create"}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingItem(null);
        }}
        onConfirm={handleDelete}
        title="Delete Menu Item"
        message={
          'Are you sure you want to delete "' +
          (deletingItem?.name ?? "") +
          '"? This cannot be undone.'
        }
        loading={deleting}
      />
    </div>
  );
}
