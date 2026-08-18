"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { categorySchema, type CategoryInput } from "@/lib/validators/schemas";
import type { ActionResponse } from "@/types";
import type { Category } from "@/generated/prisma/client";

export async function getCategories(): Promise<ActionResponse<Category[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const categories = await db.category.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return { success: true, data: categories };
  } catch (error) {
    console.error("getCategories error:", error);
    return { success: false, error: "Failed to fetch categories" };
  }
}

export async function getCategory(
  id: string
): Promise<ActionResponse<Category & { _count: { items: number } }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const category = await db.category.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });

    if (!category) return { success: false, error: "Category not found" };

    return { success: true, data: category };
  } catch (error) {
    console.error("getCategory error:", error);
    return { success: false, error: "Failed to fetch category" };
  }
}

export async function createCategory(
  data: CategoryInput
): Promise<ActionResponse<Category>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = categorySchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten().fieldErrors.name?.[0] ?? "Invalid input" };
    }

    const existing = await db.category.findUnique({
      where: { name: parsed.data.name },
    });
    if (existing) {
      return { success: false, error: "Category name already exists" };
    }

    const category = await db.category.create({
      data: parsed.data,
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "Category",
        entityId: category.id,
        newValues: category,
      },
    });

    return { success: true, data: category };
  } catch (error) {
    console.error("createCategory error:", error);
    return { success: false, error: "Failed to create category" };
  }
}

export async function updateCategory(
  id: string,
  data: CategoryInput
): Promise<ActionResponse<Category>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = categorySchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten().fieldErrors.name?.[0] ?? "Invalid input" };
    }

    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Category not found" };

    const nameConflict = await db.category.findFirst({
      where: { name: parsed.data.name, NOT: { id } },
    });
    if (nameConflict) {
      return { success: false, error: "Category name already exists" };
    }

    const category = await db.category.update({
      where: { id },
      data: parsed.data,
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Category",
        entityId: id,
        oldValues: existing,
        newValues: category,
      },
    });

    return { success: true, data: category };
  } catch (error) {
    console.error("updateCategory error:", error);
    return { success: false, error: "Failed to update category" };
  }
}

export async function deleteCategory(id: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const existing = await db.category.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!existing) return { success: false, error: "Category not found" };

    if (existing._count.items > 0) {
      return {
        success: false,
        error: `Cannot delete category with ${existing._count.items} menu item(s). Remove or reassign them first.`,
      };
    }

    await db.category.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "Category",
        entityId: id,
        oldValues: existing,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("deleteCategory error:", error);
    return { success: false, error: "Failed to delete category" };
  }
}
