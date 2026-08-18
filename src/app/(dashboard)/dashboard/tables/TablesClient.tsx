"use client";

import { useState, useCallback } from "react";
import { getTables, createTable, updateTable, deleteTable, updateTableStatus } from "@/app/actions/tables";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Table } from "@/generated/prisma/client";
import type { TableStatus, Role } from "@/generated/prisma/enums";

interface Props {
  initialTables: Table[];
  userRole: Role;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface FormState {
  number: string;
  capacity: string;
  section: string;
  status: TableStatus;
}

const emptyForm: FormState = {
  number: "",
  capacity: "4",
  section: "",
  status: "AVAILABLE",
};

const STATUS_OPTIONS: TableStatus[] = ["AVAILABLE", "OCCUPIED", "RESERVED"];

function statusBadge(status: TableStatus) {
  const base = "inline-flex rounded-full px-2 text-xs font-semibold leading-5 ";
  if (status === "AVAILABLE") return base + "bg-green-100 text-green-800";
  if (status === "OCCUPIED") return base + "bg-red-100 text-red-800";
  return base + "bg-yellow-100 text-yellow-800";
}

export default function TablesClient({ initialTables, userRole }: Props) {
  const [tables, setTables] = useState<Table[]>(initialTables);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTable, setDeletingTable] = useState<Table | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [statusFilter, setStatusFilter] = useState<TableStatus | "">("");
  const [sectionFilter, setSectionFilter] = useState("");


  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const canCreate = userRole === "ADMIN" || userRole === "MANAGER";
  const canEdit = userRole === "ADMIN";

  const sections = Array.from(new Set(tables.map((t) => t.section).filter(Boolean))) as string[];

  const filteredTables = tables.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (sectionFilter && t.section !== sectionFilter) return false;
    return true;
  });

  const refetchTables = useCallback(async () => {
    const updated = await getTables();
    const all = updated.data ?? [];
    setTables(all);
    return all;
  }, []);

  const openCreateModal = () => {
    setEditingTable(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (table: Table) => {
    setEditingTable(table);
    setForm({
      number: String(table.number),
      capacity: String(table.capacity),
      section: table.section ?? "",
      status: table.status,
    });
    setModalOpen(true);
  };

  const openDeleteConfirm = (table: Table) => {
    setDeletingTable(table);
    setDeleteConfirmOpen(true);
  };

  const handleQuickStatusChange = async (table: Table, newStatus: TableStatus) => {
    const result = await updateTableStatus(table.id, newStatus);
    if (result.success) {
      setTables((prev) =>
        prev.map((t) => (t.id === table.id ? { ...t, status: newStatus } : t))
      );
      showToast("Status updated", "success");
    } else {
      showToast(result.error ?? "Failed to update status", "error");
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        number: parseInt(form.number, 10),
        capacity: parseInt(form.capacity, 10) || 4,
        section: form.section || undefined,
        status: form.status,
      };

      if (editingTable) {
        const result = await updateTable(editingTable.id, payload);
        if (result.success) {
          await refetchTables();
          showToast("Table updated", "success");
        } else {
          showToast(result.error ?? "Failed to update", "error");
        }
      } else {
        const result = await createTable(payload);
        if (result.success) {
          await refetchTables();
          showToast("Table created", "success");
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
    if (!deletingTable) return;
    setDeleting(true);
    try {
      const result = await deleteTable(deletingTable.id);
      if (result.success) {
        setTables((prev) => prev.filter((t) => t.id !== deletingTable.id));
        showToast("Table deleted", "success");
      } else {
        showToast(result.error ?? "Failed to delete", "error");
      }
      setDeleteConfirmOpen(false);
      setDeletingTable(null);
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setDeleting(false);
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
          <h1 className="text-2xl font-bold text-gray-900">Tables</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your cafe&apos;s table layout and availability.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add Table
          </button>
        )}
      </div>

      {/* Status filter buttons */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter("")}
            className={
              "rounded-full px-3 py-1 text-xs font-medium " +
              (statusFilter === ""
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200")
            }
          >
            All ({tables.length})
          </button>
          {STATUS_OPTIONS.map((s) => {
            const count = tables.filter((t) => t.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={
                  "rounded-full px-3 py-1 text-xs font-medium " +
                  (statusFilter === s
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200")
                }
              >
                {s.charAt(0) + s.slice(1).toLowerCase()} ({count})
              </button>
            );
          })}
        </div>
        {sections.length > 0 && (
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {initialTables.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No tables yet"
            description="Add your first table to start managing the floor."
            action={
              canCreate ? (
                <button
                  onClick={openCreateModal}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Add Table
                </button>
              ) : undefined
            }
          />
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No tables match your filters"
            description="Try adjusting the status or section filter."
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
                    Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Section
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
                {filteredTables.map((table) => (
                  <tr key={table.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      #{table.number}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {table.capacity} seats
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {table.section ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={statusBadge(table.status)}>
                        {table.status.charAt(0) + table.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={table.status}
                          onChange={(e) =>
                            handleQuickStatusChange(table, e.target.value as TableStatus)
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s.charAt(0) + s.slice(1).toLowerCase()}
                            </option>
                          ))}
                        </select>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEditModal(table)}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => openDeleteConfirm(table)}
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-6 space-y-3 md:hidden">
            {filteredTables.map((table) => (
              <div key={table.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-gray-900">
                      Table #{table.number}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {table.capacity} seats
                      {table.section ? " \u2022 " + table.section : ""}
                    </p>
                  </div>
                  <span className={statusBadge(table.status)}>
                    {table.status.charAt(0) + table.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <select
                    value={table.status}
                    onChange={(e) =>
                      handleQuickStatusChange(table, e.target.value as TableStatus)
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => openEditModal(table)}
                        className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(table)}
                        className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTable ? "Edit Table" : "Add Table"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="tbl-number" className="block text-sm font-medium text-gray-700">
                Table Number
              </label>
              <input
                id="tbl-number"
                type="number"
                min={1}
                value={form.number}
                onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. 1"
              />
            </div>
            <div>
              <label htmlFor="tbl-capacity" className="block text-sm font-medium text-gray-700">
                Capacity
              </label>
              <input
                id="tbl-capacity"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="tbl-section" className="block text-sm font-medium text-gray-700">
              Section
            </label>
            <input
              id="tbl-section"
              type="text"
              value={form.section}
              onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Indoor, Patio"
            />
          </div>
          <div>
            <label htmlFor="tbl-status" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              id="tbl-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TableStatus }))}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
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
            disabled={submitting || !form.number.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : editingTable ? "Save Changes" : "Create"}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingTable(null);
        }}
        onConfirm={handleDelete}
        title="Delete Table"
        message={
          "Are you sure you want to delete Table #" +
          (deletingTable?.number ?? "") +
          "? This cannot be undone."
        }
        loading={deleting}
      />
    </div>
  );
}
