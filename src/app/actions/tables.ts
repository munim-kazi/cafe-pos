"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { tableSchema, type TableInput } from "@/lib/validators/schemas";
import type { ActionResponse } from "@/types";
import type { Table } from "@/generated/prisma/client";
import type { TableStatus } from "@/generated/prisma/enums";

interface TableFilters {
  status?: TableStatus;
  section?: string;
}

export async function getTables(
  params: TableFilters = {}
): Promise<ActionResponse<Table[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const where: Record<string, unknown> = {};

    if (params.status) {
      where.status = params.status;
    }
    if (params.section) {
      where.section = params.section;
    }

    const tables = await db.table.findMany({
      where,
      orderBy: { number: "asc" },
    });

    return { success: true, data: tables };
  } catch (error) {
    console.error("getTables error:", error);
    return { success: false, error: "Failed to fetch tables" };
  }
}

export async function getTable(
  id: string
) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const table = await db.table.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
            createdAt: true,
          },
        },
      },
    });

    if (!table) return { success: false, error: "Table not found" };

    return { success: true, data: table };
  } catch (error) {
    console.error("getTable error:", error);
    return { success: false, error: "Failed to fetch table" };
  }
}

export async function createTable(
  data: TableInput
): Promise<ActionResponse<Table>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = tableSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, error: firstError ?? "Invalid input" };
    }

    const existing = await db.table.findUnique({
      where: { number: parsed.data.number },
    });
    if (existing) {
      return { success: false, error: "Table number already exists" };
    }

    const table = await db.table.create({
      data: parsed.data,
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "Table",
        entityId: table.id,
        newValues: table,
      },
    });

    return { success: true, data: table };
  } catch (error) {
    console.error("createTable error:", error);
    return { success: false, error: "Failed to create table" };
  }
}

export async function updateTable(
  id: string,
  data: TableInput
): Promise<ActionResponse<Table>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = tableSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, error: firstError ?? "Invalid input" };
    }

    const existing = await db.table.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Table not found" };

    const numberConflict = await db.table.findFirst({
      where: { number: parsed.data.number, NOT: { id } },
    });
    if (numberConflict) {
      return { success: false, error: "Table number already exists" };
    }

    const table = await db.table.update({
      where: { id },
      data: parsed.data,
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Table",
        entityId: id,
        oldValues: existing,
        newValues: table,
      },
    });

    return { success: true, data: table };
  } catch (error) {
    console.error("updateTable error:", error);
    return { success: false, error: "Failed to update table" };
  }
}

export async function deleteTable(id: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const existing = await db.table.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Table not found" };

    const activeOrders = await db.order.count({
      where: {
        tableId: id,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    });
    if (activeOrders > 0) {
      return {
        success: false,
        error: `Cannot delete table with ${activeOrders} active order(s). Complete or cancel them first.`,
      };
    }

    await db.table.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "Table",
        entityId: id,
        oldValues: existing,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("deleteTable error:", error);
    return { success: false, error: "Failed to delete table" };
  }
}

export async function updateTableStatus(
  id: string,
  status: TableStatus
): Promise<ActionResponse<Table>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const existing = await db.table.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Table not found" };

    const table = await db.table.update({
      where: { id },
      data: { status },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Table",
        entityId: id,
        oldValues: { status: existing.status },
        newValues: { status: table.status },
      },
    });

    return { success: true, data: table };
  } catch (error) {
    console.error("updateTableStatus error:", error);
    return { success: false, error: "Failed to update table status" };
  }
}
