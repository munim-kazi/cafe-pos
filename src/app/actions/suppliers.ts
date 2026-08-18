"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { supplierSchema, type SupplierInput } from "@/lib/validators/schemas";
import type { ActionResponse } from "@/types";
import type { Supplier } from "@/generated/prisma/client";

interface SupplierFilters {
  search?: string;
}

export async function getSuppliers(
  params: SupplierFilters = {}
): Promise<ActionResponse<Supplier[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const where: Record<string, unknown> = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { company: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const suppliers = await db.supplier.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return { success: true, data: suppliers };
  } catch (error) {
    console.error("getSuppliers error:", error);
    return { success: false, error: "Failed to fetch suppliers" };
  }
}

export async function getSupplier(
  id: string
): Promise<ActionResponse<Supplier & { _count: { purchases: number } }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { purchases: true } },
      },
    });

    if (!supplier) return { success: false, error: "Supplier not found" };

    return { success: true, data: supplier };
  } catch (error) {
    console.error("getSupplier error:", error);
    return { success: false, error: "Failed to fetch supplier" };
  }
}

export async function createSupplier(
  data: SupplierInput
): Promise<ActionResponse<Supplier>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = supplierSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, error: firstError ?? "Invalid input" };
    }

    const supplier = await db.supplier.create({
      data: parsed.data,
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "Supplier",
        entityId: supplier.id,
        newValues: supplier,
      },
    });

    return { success: true, data: supplier };
  } catch (error) {
    console.error("createSupplier error:", error);
    return { success: false, error: "Failed to create supplier" };
  }
}

export async function updateSupplier(
  id: string,
  data: SupplierInput
): Promise<ActionResponse<Supplier>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = supplierSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, error: firstError ?? "Invalid input" };
    }

    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Supplier not found" };

    const supplier = await db.supplier.update({
      where: { id },
      data: parsed.data,
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Supplier",
        entityId: id,
        oldValues: existing,
        newValues: supplier,
      },
    });

    return { success: true, data: supplier };
  } catch (error) {
    console.error("updateSupplier error:", error);
    return { success: false, error: "Failed to update supplier" };
  }
}

export async function deleteSupplier(id: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Supplier not found" };

    if (Number(existing.dueBalance) > 0) {
      return {
        success: false,
        error: `Cannot delete supplier with outstanding balance of ${existing.dueBalance}. Settle the balance first.`,
      };
    }

    await db.supplier.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "Supplier",
        entityId: id,
        oldValues: existing,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("deleteSupplier error:", error);
    return { success: false, error: "Failed to delete supplier" };
  }
}
