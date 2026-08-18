"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import type { ActionResponse, PaginatedResponse } from "@/types";

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

const VALID_ROLES = ["ADMIN", "MANAGER", "CASHIER", "KITCHEN"];
const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 3,
  MANAGER: 2,
  CASHIER: 1,
  KITCHEN: 0,
};

function canManageRole(
  callerRole: string,
  targetRole: string
): boolean {
  if (callerRole === "ADMIN") return true;
  const callerLevel = ROLE_HIERARCHY[callerRole] ?? -1;
  const targetLevel = ROLE_HIERARCHY[targetRole] ?? -1;
  return callerLevel > targetLevel;
}

function formatStaffMember(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date;
}): StaffMember {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: null,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    lastLogin: null,
  };
}

// ─── List staff (ADMIN only) ────────────────────────────────────────────────

export async function getStaffMembers(
  params: {
    page?: number;
    pageSize?: number;
    role?: string;
    search?: string;
    active?: boolean;
  } = {}
): Promise<ActionResponse<PaginatedResponse<StaffMember>>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };
    if (session.user.role !== "ADMIN")
      return { success: false, error: "Access denied" };

    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));

    const where: Record<string, unknown> = {};

    if (params.role) {
      where.role = params.role;
    }

    if (params.active !== undefined) {
      where.active = params.active;
    }

    if (params.search) {
      const term = params.search.trim();
      if (term) {
        where.OR = [
          { name: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
        ];
      }
    }

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        items: users.map(formatStaffMember),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("getStaffMembers error:", error);
    return { success: false, error: "Failed to fetch staff members" };
  }
}

// ─── Get single staff member (ADMIN only) ───────────────────────────────────

export async function getStaffMember(
  id: string
): Promise<ActionResponse<StaffMember>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };
    if (session.user.role !== "ADMIN")
      return { success: false, error: "Access denied" };

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    if (!user) return { success: false, error: "Staff member not found" };

    return { success: true, data: formatStaffMember(user) };
  } catch (error) {
    console.error("getStaffMember error:", error);
    return { success: false, error: "Failed to fetch staff member" };
  }
}

// ─── Create staff (ADMIN / MANAGER) ─────────────────────────────────────────

export async function createStaffMember(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: string;
}): Promise<ActionResponse<{ id: string; name: string; email: string; role: string }>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };
    if (
      session.user.role !== "ADMIN" &&
      session.user.role !== "MANAGER"
    ) {
      return { success: false, error: "Access denied" };
    }

    const { name, email, password, role } = data;

    if (!name?.trim())
      return { success: false, error: "Name is required" };
    if (!email?.trim())
      return { success: false, error: "Email is required" };
    if (!password || password.length < 8)
      return {
        success: false,
        error: "Password must be at least 8 characters",
      };
    if (!role || !VALID_ROLES.includes(role))
      return { success: false, error: "Invalid role" };

    if (!canManageRole(session.user.role, role)) {
      return {
        success: false,
        error: "Insufficient permissions to create this role",
      };
    }

    const existing = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing)
      return { success: false, error: "Email already in use" };

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role: role as "ADMIN" | "MANAGER" | "CASHIER" | "KITCHEN",
        active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "User",
        entityId: user.id,
        newValues: { name: user.name, email: user.email, role: user.role },
      },
    });

    return { success: true, data: user };
  } catch (error) {
    console.error("createStaffMember error:", error);
    return { success: false, error: "Failed to create staff member" };
  }
}

// ─── Update staff (ADMIN only) ──────────────────────────────────────────────

export async function updateStaffMember(
  id: string,
  data: {
    name?: string;
    phone?: string;
    role?: string;
    active?: boolean;
  }
): Promise<ActionResponse<{ id: string; name: string; role: string; active: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };
    if (session.user.role !== "ADMIN")
      return { success: false, error: "Access denied" };

    if (data.active === false && id === session.user.id) {
      return {
        success: false,
        error: "Cannot deactivate your own account",
      };
    }

    if (data.role && id === session.user.id) {
      return {
        success: false,
        error: "Cannot change your own role",
      };
    }

    if (data.role && !VALID_ROLES.includes(data.role)) {
      return { success: false, error: "Invalid role" };
    }

    if (data.role && !canManageRole(session.user.role, data.role)) {
      return {
        success: false,
        error: "Insufficient permissions to assign this role",
      };
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing)
      return { success: false, error: "Staff member not found" };

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.role !== undefined)
      updateData.role = data.role as "ADMIN" | "MANAGER" | "CASHIER" | "KITCHEN";
    if (data.active !== undefined) updateData.active = data.active;

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "No changes to apply" };
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        role: true,
        active: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "User",
        entityId: id,
        oldValues: {
          name: existing.name,
          role: existing.role,
          active: existing.active,
        },
        newValues: user,
      },
    });

    return { success: true, data: user };
  } catch (error) {
    console.error("updateStaffMember error:", error);
    return { success: false, error: "Failed to update staff member" };
  }
}

// ─── Reset password (ADMIN only) ────────────────────────────────────────────

export async function resetStaffPassword(
  id: string,
  newPassword: string
): Promise<ActionResponse<{ message: string }>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };
    if (session.user.role !== "ADMIN")
      return { success: false, error: "Access denied" };

    if (!newPassword || newPassword.length < 8)
      return {
        success: false,
        error: "Password must be at least 8 characters",
      };

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing)
      return { success: false, error: "Staff member not found" };

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "User",
        entityId: id,
        newValues: { password: "[REDACTED]" },
      },
    });

    return { success: true, data: { message: "Password reset successfully" } };
  } catch (error) {
    console.error("resetStaffPassword error:", error);
    return { success: false, error: "Failed to reset password" };
  }
}

// ─── Staff stats (ADMIN only) ───────────────────────────────────────────────

export async function getStaffStats(): Promise<
  ActionResponse<{
    totalActive: number;
    byRole: Record<string, number>;
    recentlyActive: number;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };
    if (session.user.role !== "ADMIN")
      return { success: false, error: "Access denied" };

    const [totalActive, roleCounts, recentlyActive] = await Promise.all([
      db.user.count({ where: { active: true } }),
      db.user.groupBy({
        by: ["role"],
        where: { active: true },
        _count: true,
      }),
      db.user.count({
        where: {
          active: true,
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const byRole: Record<string, number> = {};
    for (const rc of roleCounts) {
      byRole[rc.role] = rc._count;
    }

    return {
      success: true,
      data: {
        totalActive,
        byRole,
        recentlyActive,
      },
    };
  } catch (error) {
    console.error("getStaffStats error:", error);
    return { success: false, error: "Failed to fetch staff stats" };
  }
}
