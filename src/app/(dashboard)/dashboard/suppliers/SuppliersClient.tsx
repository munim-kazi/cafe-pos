"use client";

import { useState, useCallback } from "react";
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "@/app/actions/suppliers";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Supplier } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

interface Props {
  initialSuppliers: Supplier[];
  userRole: Role;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface FormState {
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
}

const emptyForm: FormState = {
  name: "",
  company: "",
  phone: "",
  email: "",
  address: "",
};

export default function SuppliersClient({ initialSuppliers, userRole }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);


  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const canCreate = userRole === "ADMIN" || userRole === "MANAGER";
  const canEdit = userRole === "ADMIN";

  const handleSearch = useCallback(async (value: string) => {
    const result = await getSuppliers({ search: value || undefined });
    setSuppliers(result.data ?? []);
  }, []);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      company: supplier.company ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
    });
    setModalOpen(true);
  };

  const openDeleteConfirm = (supplier: Supplier) => {
    setDeletingSupplier(supplier);
    setDeleteConfirmOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        company: form.company || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
      };

      if (editingSupplier) {
        const result = await updateSupplier(editingSupplier.id, payload);
        if (result.success) {
          const updated = await getSuppliers();
          setSuppliers(updated.data ?? []);
          showToast("Supplier updated", "success");
        } else {
          showToast(result.error ?? "Failed to update", "error");
        }
      } else {
        const result = await createSupplier(payload);
        if (result.success) {
          const updated = await getSuppliers();
          setSuppliers(updated.data ?? []);
          showToast("Supplier created", "success");
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
    if (!deletingSupplier) return;
    setDeleting(true);
    try {
      const result = await deleteSupplier(deletingSupplier.id);
      if (result.success) {
        setSuppliers((prev) => prev.filter((s) => s.id !== deletingSupplier.id));
        showToast("Supplier deleted", "success");
      } else {
        showToast(result.error ?? "Failed to delete", "error");
      }
      setDeleteConfirmOpen(false);
      setDeletingSupplier(null);
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setDeleting(false);
    }
  };

  const formatBalance = (balance: unknown) => {
    const num = typeof balance === "number" ? balance : parseFloat(String(balance ?? 0));
    return "$" + num.toFixed(2);
  };

  const toastClass =
    "fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg " +
    (toast?.type === "success" ? "bg-green-600" : "bg-red-600");

  return (
    <div>
      {toast && <div className={toastClass}>{toast.message}</div>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your supplier directory and balances.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add Supplier
          </button>
        )}
      </div>

      <div className="mt-4 w-full sm:w-64">
        <SearchInput placeholder="Search by name or company..." onSearch={handleSearch} />
      </div>

      {initialSuppliers.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No suppliers yet"
            description="Add your first supplier to get started."
            action={
              canCreate ? (
                <button
                  onClick={openCreateModal}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Add Supplier
                </button>
              ) : undefined
            }
          />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No suppliers found"
            description="Try a different search term."
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
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Due Balance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {supplier.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {supplier.company ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {supplier.phone ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {supplier.email ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatBalance(supplier.dueBalance)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(supplier)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(supplier)}
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
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-gray-900">
                      {supplier.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {supplier.company ?? "\u2014"}
                      {supplier.phone ? " \u2022 " + supplier.phone : ""}
                    </p>
                  </div>
                  <span className="ml-2 shrink-0 text-sm font-medium text-gray-900">
                    {formatBalance(supplier.dueBalance)}
                  </span>
                </div>
                {canEdit && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openEditModal(supplier)}
                      className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDeleteConfirm(supplier)}
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
        title={editingSupplier ? "Edit Supplier" : "Add Supplier"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sup-name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                id="sup-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. John Smith"
              />
            </div>
            <div>
              <label htmlFor="sup-company" className="block text-sm font-medium text-gray-700">
                Company
              </label>
              <input
                id="sup-company"
                type="text"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sup-phone" className="block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                id="sup-phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label htmlFor="sup-email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="sup-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label htmlFor="sup-address" className="block text-sm font-medium text-gray-700">
              Address
            </label>
            <textarea
              id="sup-address"
              rows={2}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Optional"
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
            onClick={handleSubmit}
            disabled={submitting || !form.name.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : editingSupplier ? "Save Changes" : "Create"}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingSupplier(null);
        }}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message={
          Number(deletingSupplier?.dueBalance ?? 0) > 0
            ? "Cannot delete supplier with an outstanding balance of " +
              formatBalance(deletingSupplier?.dueBalance ?? 0) +
              ". Settle the balance first."
            : 'Are you sure you want to delete "' +
              (deletingSupplier?.name ?? "") +
              '"? This cannot be undone.'
        }
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
