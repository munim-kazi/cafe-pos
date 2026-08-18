"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { customerSchema, type CustomerInput } from "@/lib/validators/schemas";
import type { ActionResponse } from "@/types";
import type { Customer } from "@/generated/prisma/client";

interface CustomerFilters {
  search?: string;
}

export async function getCustomers(
  params: CustomerFilters = {}
): Promise<ActionResponse<Customer[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const where: Record<string, unknown> = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { phone: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const customers = await db.customer.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return { success: true, data: customers };
  } catch (error) {
    console.error("getCustomers error:", error);
    return { success: false, error: "Failed to fetch customers" };
  }
}

export async function getCustomer(
  id: string
): Promise<ActionResponse<Customer & { _count: { orders: number } }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
      },
    });

    if (!customer) return { success: false, error: "Customer not found" };

    return { success: true, data: customer };
  } catch (error) {
    console.error("getCustomer error:", error);
    return { success: false, error: "Failed to fetch customer" };
  }
}

export async function createCustomer(
  data: CustomerInput
): Promise<ActionResponse<Customer>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER", "CASHIER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = customerSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, error: firstError ?? "Invalid input" };
    }

    const customer = await db.customer.create({
      data: parsed.data,
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "Customer",
        entityId: customer.id,
        newValues: customer,
      },
    });

    return { success: true, data: customer };
  } catch (error) {
    console.error("createCustomer error:", error);
    return { success: false, error: "Failed to create customer" };
  }
}

export async function updateCustomer(
  id: string,
  data: CustomerInput
): Promise<ActionResponse<Customer>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER", "CASHIER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = customerSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, error: firstError ?? "Invalid input" };
    }

    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Customer not found" };

    const customer = await db.customer.update({
      where: { id },
      data: parsed.data,
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Customer",
        entityId: id,
        oldValues: existing,
        newValues: customer,
      },
    });

    return { success: true, data: customer };
  } catch (error) {
    console.error("updateCustomer error:", error);
    return { success: false, error: "Failed to update customer" };
  }
}

export async function deleteCustomer(id: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER", "CASHIER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Customer not found" };

    if (Number(existing.dueBalance) > 0) {
      return {
        success: false,
        error: `Cannot delete customer with outstanding balance of ${existing.dueBalance}. Settle the balance first.`,
      };
    }

    await db.customer.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "Customer",
        entityId: id,
        oldValues: existing,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("deleteCustomer error:", error);
    return { success: false, error: "Failed to delete customer" };
  }
}
