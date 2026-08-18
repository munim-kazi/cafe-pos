"use client";

import { useState, useCallback } from "react";
import {
  getStaffMembers,
  getStaffStats,
  createStaffMember,
  updateStaffMember,
  resetStaffPassword,
} from "@/app/actions/staff";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";

type StaffMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  active: boolean;
  createdAt: string;
  lastLogin: string | null;
};

type StaffStats = {
  totalActive: number;
  byRole: Record<string, number>;
  recentlyActive: number;
};

interface Props {
  userId: string;
  initialStaff: StaffMember[];
  initialStats: StaffStats;
  initialPagination: { total: number; page: number; pageSize: number; totalPages: number };
}

interface Toast {
  message: string;
  type: "success" | "error";
}

const ROLE_BADGE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800",
  MANAGER: "bg-blue-100 text-blue-800",
  CASHIER: "bg-green-100 text-green-800",
  KITCHEN: "bg-yellow-100 text-yellow-800",
};

const ROLES = ["ADMIN", "MANAGER", "CASHIER", "KITCHEN"];

interface AddForm {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: string;
}

interface EditForm {
  name: string;
  phone: string;
  role: string;
  active: boolean;
}

const emptyAddForm: AddForm = {
  name: "",
  email: "",
  password: "",
  phone: "",
  role: "CASHIER",
};

const emptyEditForm: EditForm = {
  name: "",
  phone: "",
  role: "CASHIER",
  active: true,
};

export default function StaffClient({ userId, initialStaff, initialStats, initialPagination }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [pagination, setPagination] = useState(initialPagination);
  const [stats, setStats] = useState<StaffStats | null>(initialStats);
  const [loading, setLoading] = useState(false);

  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(emptyAddForm);
  const [adding, setAdding] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetName, setResetName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadStaff = useCallback(
    async (
      page?: number,
      role?: string,
      search?: string,
      active?: boolean
    ) => {
      setLoading(true);
      const result = await getStaffMembers({
        page: page ?? pagination.page,
        pageSize: 20,
        role: role || undefined,
        search: search || undefined,
        active,
      });
      if (result.success && result.data) {
        setStaff(result.data.items);
        setPagination({
          total: result.data.total,
          page: result.data.page,
          pageSize: result.data.pageSize,
          totalPages: result.data.totalPages,
        });
      }
      setLoading(false);
    },
    [pagination.page]
  );

  const loadStats = useCallback(async () => {
    const result = await getStaffStats();
    if (result.success && result.data) {
      setStats(result.data);
    }
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchTerm(value);
      loadStaff(1, roleFilter, value, undefined);
    },
    [roleFilter, loadStaff]
  );

  const handleRoleFilter = (role: string) => {
    setRoleFilter(role);
    loadStaff(
      1,
      role,
      searchTerm,
      activeFilter !== "" ? activeFilter === "true" : undefined
    );
  };

  const handleActiveFilter = (value: string) => {
    setActiveFilter(value);
    loadStaff(
      1,
      roleFilter,
      searchTerm,
      value !== "" ? value === "true" : undefined
    );
  };

  const openAddModal = () => {
    setAddForm(emptyAddForm);
    setAddModalOpen(true);
  };

  const openEditModal = (member: StaffMember) => {
    setEditingId(member.id);
    setEditForm({
      name: member.name,
      phone: member.phone ?? "",
      role: member.role,
      active: member.active,
    });
    setEditModalOpen(true);
  };

  const openResetModal = (member: StaffMember) => {
    setResetId(member.id);
    setResetName(member.name);
    setNewPassword("");
    setResetModalOpen(true);
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      const result = await createStaffMember({
        name: addForm.name,
        email: addForm.email,
        password: addForm.password,
        phone: addForm.phone || undefined,
        role: addForm.role,
      });
      if (result.success) {
        showToast("Staff member created", "success");
        setAddModalOpen(false);
        loadStaff(1, roleFilter, searchTerm, undefined);
        loadStats();
      } else {
        showToast(result.error ?? "Failed to create", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async () => {
    if (!editingId) return;
    setEditing(true);
    try {
      const result = await updateStaffMember(editingId, {
        name: editForm.name,
        phone: editForm.phone,
        role: editForm.role,
        active: editForm.active,
      });
      if (result.success) {
        showToast("Staff member updated", "success");
        setEditModalOpen(false);
        loadStaff(undefined, roleFilter, searchTerm, undefined);
        loadStats();
      } else {
        showToast(result.error ?? "Failed to update", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setEditing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetId) return;
    setResetting(true);
    try {
      const result = await resetStaffPassword(resetId, newPassword);
      if (result.success) {
        showToast("Password reset successfully", "success");
        setResetModalOpen(false);
      } else {
        showToast(result.error ?? "Failed to reset password", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setResetting(false);
    }
  };

  const goToPage = (page: number) => {
    loadStaff(page, roleFilter, searchTerm, undefined);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-BD", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const toastClass =
    "fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg " +
    (toast?.type === "success" ? "bg-green-600" : "bg-red-600");

  const inputClass =
    "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <div>
      {toast && <div className={toastClass}>{toast.message}</div>}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your team members, roles and access.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add Staff Member
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-500">Total Active Staff</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.totalActive}</p>
          </div>
          {ROLES.map((role) => (
            <div key={role} className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm font-medium text-gray-500">{role}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {stats.byRole[role] ?? 0}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:w-64">
          <SearchInput placeholder="Search by name or email..." onSearch={handleSearch} />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => handleRoleFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => handleActiveFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <span className="ml-auto text-sm text-gray-500">
          {pagination.total} total
        </span>
      </div>

      {/* Staff Table - Desktop */}
      <div className="mt-4 hidden overflow-hidden rounded-lg border border-gray-200 md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                  No staff members found.
                </td>
              </tr>
            ) : (
              staff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {member.name}
                    {member.id === userId && (
                      <span className="ml-2 text-xs text-gray-400">(You)</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {member.email}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span
                      className={
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold " +
                        (ROLE_BADGE_COLORS[member.role] ?? "bg-gray-100 text-gray-800")
                      }
                    >
                      {member.role}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span
                      className={
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold " +
                        (member.active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-500")
                      }
                    >
                      {member.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(member.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(member)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Edit"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openResetModal(member)}
                        className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                        title="Reset Password"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Staff Cards - Mobile */}
      <div className="mt-4 space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-500">
            Loading...
          </div>
        ) : staff.length === 0 ? (
          <div className="rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-500">
            No staff members found.
          </div>
        ) : (
          staff.map((member) => (
            <div key={member.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-gray-900">
                      {member.name}
                    </h3>
                    {member.id === userId && (
                      <span className="text-xs text-gray-400">(You)</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{member.email}</p>
                </div>
                <div className="ml-2 flex flex-col items-end gap-1">
                  <span
                    className={
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold " +
                      (ROLE_BADGE_COLORS[member.role] ?? "bg-gray-100 text-gray-800")
                    }
                  >
                    {member.role}
                  </span>
                  <span
                    className={
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold " +
                      (member.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-500")
                    }
                  >
                    {member.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => openEditModal(member)}
                  className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => openResetModal(member)}
                  className="rounded border border-blue-300 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                >
                  Reset Password
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Staff Member"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="add-name" className={labelClass}>
              Name *
            </label>
            <input
              id="add-name"
              type="text"
              value={addForm.name}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, name: e.target.value }))
              }
              className={inputClass}
              placeholder="e.g. John Doe"
            />
          </div>
          <div>
            <label htmlFor="add-email" className={labelClass}>
              Email *
            </label>
            <input
              id="add-email"
              type="email"
              value={addForm.email}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, email: e.target.value }))
              }
              className={inputClass}
              placeholder="john@cafe.com"
            />
          </div>
          <div>
            <label htmlFor="add-password" className={labelClass}>
              Password *
            </label>
            <input
              id="add-password"
              type="password"
              value={addForm.password}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, password: e.target.value }))
              }
              className={inputClass}
              placeholder="Min. 6 characters"
            />
          </div>
          <div>
            <label htmlFor="add-phone" className={labelClass}>
              Phone
            </label>
            <input
              id="add-phone"
              type="text"
              value={addForm.phone}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, phone: e.target.value }))
              }
              className={inputClass}
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="add-role" className={labelClass}>
              Role *
            </label>
            <select
              id="add-role"
              value={addForm.role}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, role: e.target.value }))
              }
              className={inputClass}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setAddModalOpen(false)}
            disabled={adding}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={
              adding ||
              !addForm.name.trim() ||
              !addForm.email.trim() ||
              !addForm.password
            }
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {adding ? "Creating..." : "Create"}
          </button>
        </div>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Staff Member"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-name" className={labelClass}>
              Name
            </label>
            <input
              id="edit-name"
              type="text"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, name: e.target.value }))
              }
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="edit-phone" className={labelClass}>
              Phone
            </label>
            <input
              id="edit-phone"
              type="text"
              value={editForm.phone}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, phone: e.target.value }))
              }
              className={inputClass}
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="edit-role" className={labelClass}>
              Role
            </label>
            <select
              id="edit-role"
              value={editForm.role}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, role: e.target.value }))
              }
              className={inputClass}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="edit-active" className="text-sm font-medium text-gray-700">
              Active
            </label>
            <button
              id="edit-active"
              type="button"
              role="switch"
              aria-checked={editForm.active}
              onClick={() =>
                setEditForm((f) => ({ ...f, active: !f.active }))
              }
              className={
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 " +
                (editForm.active ? "bg-indigo-600" : "bg-gray-200")
              }
            >
              <span
                className={
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out " +
                  (editForm.active ? "translate-x-5" : "translate-x-0")
                }
              />
            </button>
            <span className="text-sm text-gray-500">
              {editForm.active ? "Active" : "Inactive"}
            </span>
          </div>
          {editingId === userId && !editForm.active && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
              Warning: You are about to deactivate your own account. You will be
              logged out and unable to access the system.
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setEditModalOpen(false)}
            disabled={editing}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleEdit}
            disabled={editing || !editForm.name.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {editing ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset Password"
      >
        <p className="text-sm text-gray-600">
          Enter a new password for <strong>{resetName}</strong>.
        </p>
        <div className="mt-4">
          <label htmlFor="reset-password" className={labelClass}>
            New Password
          </label>
          <input
            id="reset-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
            placeholder="Min. 6 characters"
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setResetModalOpen(false)}
            disabled={resetting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleResetPassword}
            disabled={resetting || newPassword.length < 6}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset Password"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
