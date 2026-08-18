"use client";

import { useState, useCallback } from "react";
import { createCategory, updateCategory, deleteCategory } from "@/app/actions/categories";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Category } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

interface Props {
  initialCategories: Category[];
  userRole: Role;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

export default function CategoriesClient({ initialCategories, userRole }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [form, setForm] = useState({ name: "", sortOrder: 0, active: true });


  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const canCreate = userRole === "ADMIN" || userRole === "MANAGER";
  const canEdit = userRole === "ADMIN";

  const openCreateModal = () => {
    setEditingCategory(null);
    setForm({ name: "", sortOrder: categories.length, active: true });
    setModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setForm({ name: cat.name, sortOrder: cat.sortOrder, active: cat.active });
    setModalOpen(true);
  };

  const openDeleteConfirm = (cat: Category) => {
    setDeletingCategory(cat);
    setDeleteConfirmOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingCategory) {
        const result = await updateCategory(editingCategory.id, form);
        if (result.success) {
          setCategories((prev) =>
            prev.map((c) => (c.id === editingCategory.id ? { ...c, ...form } : c))
          );
          showToast("Category updated", "success");
        } else {
          showToast(result.error ?? "Failed to update category", "error");
        }
      } else {
        const result = await createCategory(form);
        if (result.success && result.data) {
          setCategories((prev) => [...prev, result.data!].sort((a, b) => a.sortOrder - b.sortOrder));
          showToast("Category created", "success");
        } else {
          showToast(result.error ?? "Failed to create category", "error");
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
    if (!deletingCategory) return;
    setDeleting(true);
    try {
      const result = await deleteCategory(deletingCategory.id);
      if (result.success) {
        setCategories((prev) => prev.filter((c) => c.id !== deletingCategory.id));
        showToast("Category deleted", "success");
      } else {
        showToast(result.error ?? "Failed to delete category", "error");
      }
      setDeleteConfirmOpen(false);
      setDeletingCategory(null);
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize your menu items into categories.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add Category
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No categories yet"
            description="Create your first category to organize menu items."
            action={
              canCreate ? (
                <button
                  onClick={openCreateModal}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Add Category
                </button>
              ) : undefined
            }
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
                    Sort Order
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
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {cat.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {cat.sortOrder}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          cat.active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {cat.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(cat)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(cat)}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{cat.name}</h3>
                    <p className="mt-0.5 text-xs text-gray-500">Order: {cat.sortOrder}</p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                      cat.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {cat.active ? "Active" : "Inactive"}
                  </span>
                </div>
                {canEdit && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openEditModal(cat)}
                      className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDeleteConfirm(cat)}
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
        title={editingCategory ? "Edit Category" : "Add Category"}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="cat-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="cat-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Beverages"
            />
          </div>
          <div>
            <label htmlFor="cat-sort" className="block text-sm font-medium text-gray-700">
              Sort Order
            </label>
            <input
              id="cat-sort"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) =>
                setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="cat-active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="cat-active" className="text-sm text-gray-700">
              Active
            </label>
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
            disabled={submitting || !form.name.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : editingCategory ? "Save Changes" : "Create"}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingCategory(null);
        }}
        onConfirm={handleDelete}
        title="Delete Category"
        message={`Are you sure you want to delete "${deletingCategory?.name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
