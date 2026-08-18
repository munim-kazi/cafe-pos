"use client";

import { useState, useCallback } from "react";
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/app/actions/customers";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Customer } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

interface Props {
  initialCustomers: Customer[];
  userRole: Role;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
}

const emptyForm: FormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
};

export default function CustomersClient({ initialCustomers, userRole }: Props) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
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
    const result = await getCustomers({ search: value || undefined });
    setCustomers(result.data ?? []);
  }, []);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
    });
    setModalOpen(true);
  };

  const openDeleteConfirm = (customer: Customer) => {
    setDeletingCustomer(customer);
    setDeleteConfirmOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
      };

      if (editingCustomer) {
        const result = await updateCustomer(editingCustomer.id, payload);
        if (result.success) {
          const updated = await getCustomers();
          setCustomers(updated.data ?? []);
          showToast("Customer updated", "success");
        } else {
          showToast(result.error ?? "Failed to update", "error");
        }
      } else {
        const result = await createCustomer(payload);
        if (result.success) {
          const updated = await getCustomers();
          setCustomers(updated.data ?? []);
          showToast("Customer created", "success");
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
    if (!deletingCustomer) return;
    setDeleting(true);
    try {
      const result = await deleteCustomer(deletingCustomer.id);
      if (result.success) {
        setCustomers((prev) => prev.filter((c) => c.id !== deletingCustomer.id));
        showToast("Customer deleted", "success");
      } else {
        showToast(result.error ?? "Failed to delete", "error");
      }
      setDeleteConfirmOpen(false);
      setDeletingCustomer(null);
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
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your customer directory and balances.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add Customer
          </button>
        )}
      </div>

      <div className="mt-4 w-full sm:w-64">
        <SearchInput placeholder="Search by name or phone..." onSearch={handleSearch} />
      </div>

      {initialCustomers.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No customers yet"
            description="Add your first customer to get started."
            action={
              canCreate ? (
                <button
                  onClick={openCreateModal}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Add Customer
                </button>
              ) : undefined
            }
          />
        </div>
      ) : customers.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No customers found"
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
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {customer.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {customer.phone ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {customer.email ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatBalance(customer.dueBalance)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(customer)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(customer)}
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
            {customers.map((customer) => (
              <div key={customer.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-gray-900">
                      {customer.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {customer.phone ?? "\u2014"}
                      {customer.email ? " \u2022 " + customer.email : ""}
                    </p>
                  </div>
                  <span className="ml-2 shrink-0 text-sm font-medium text-gray-900">
                    {formatBalance(customer.dueBalance)}
                  </span>
                </div>
                {canEdit && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openEditModal(customer)}
                      className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDeleteConfirm(customer)}
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
        title={editingCustomer ? "Edit Customer" : "Add Customer"}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="cust-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="cust-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. John Doe"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cust-phone" className="block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                id="cust-phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label htmlFor="cust-email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="cust-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label htmlFor="cust-address" className="block text-sm font-medium text-gray-700">
              Address
            </label>
            <textarea
              id="cust-address"
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
            {submitting ? "Saving..." : editingCustomer ? "Save Changes" : "Create"}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingCustomer(null);
        }}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={
          Number(deletingCustomer?.dueBalance ?? 0) > 0
            ? "Cannot delete customer with an outstanding balance of " +
              formatBalance(deletingCustomer?.dueBalance ?? 0) +
              ". Settle the balance first."
            : 'Are you sure you want to delete "' +
              (deletingCustomer?.name ?? "") +
              '"? This cannot be undone.'
        }
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
