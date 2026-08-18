"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { menuItemSchema, type MenuItemInput } from "@/lib/validators/schemas";
import type { ActionResponse } from "@/types";
import type { MenuItem } from "@/generated/prisma/client";

interface MenuItemFilters {
  categoryId?: string;
  search?: string;
  available?: boolean;
}

export async function getMenuItems(
  params: MenuItemFilters = {}
): Promise<ActionResponse<MenuItem[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const where: Record<string, unknown> = {};

    if (params.categoryId) {
      where.categoryId = params.categoryId;
    }
    if (params.available !== undefined) {
      where.available = params.available;
    }
    if (params.search) {
      where.name = { contains: params.search, mode: "insensitive" };
    }

    const menuItems = await db.menuItem.findMany({
      where,
      include: {
        category: true,
        variants: {
          include: {
            addons: {
              include: { addon: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return { success: true, data: menuItems };
  } catch (error) {
    console.error("getMenuItems error:", error);
    return { success: false, error: "Failed to fetch menu items" };
  }
}

export async function getMenuItem(
  id: string
): Promise<ActionResponse<MenuItem>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const menuItem = await db.menuItem.findUnique({
      where: { id },
      include: {
        category: true,
        variants: {
          include: {
            addons: {
              include: { addon: true },
            },
          },
        },
        recipes: {
          include: { ingredient: true },
        },
      },
    });

    if (!menuItem) return { success: false, error: "Menu item not found" };

    return { success: true, data: menuItem };
  } catch (error) {
    console.error("getMenuItem error:", error);
    return { success: false, error: "Failed to fetch menu item" };
  }
}

export async function createMenuItem(
  data: MenuItemInput
): Promise<ActionResponse<MenuItem>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = menuItemSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, error: firstError ?? "Invalid input" };
    }

    const categoryExists = await db.category.findUnique({
      where: { id: parsed.data.categoryId },
    });
    if (!categoryExists) {
      return { success: false, error: "Category not found" };
    }

    const { variants, ...itemData } = parsed.data;

    const menuItem = await db.$transaction(async (tx) => {
      const item = await tx.menuItem.create({
        data: {
          ...itemData,
          basePrice: itemData.basePrice,
        },
      });

      for (const variant of variants) {
        const createdVariant = await tx.variant.create({
          data: {
            menuItemId: item.id,
            name: variant.name,
            priceAdjust: variant.priceAdjust,
            available: variant.available,
          },
        });

        if (variant.addonIds.length > 0) {
          await tx.addonOnVariant.createMany({
            data: variant.addonIds.map((addonId) => ({
              variantId: createdVariant.id,
              addonId,
            })),
          });
        }
      }

      return tx.menuItem.findUnique({
        where: { id: item.id },
        include: {
          category: true,
          variants: {
            include: {
              addons: { include: { addon: true } },
            },
          },
        },
      });
    });

    if (!menuItem) throw new Error("Failed to create menu item");

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "MenuItem",
        entityId: menuItem.id,
        newValues: menuItem,
      },
    });

    return { success: true, data: menuItem };
  } catch (error) {
    console.error("createMenuItem error:", error);
    return { success: false, error: "Failed to create menu item" };
  }
}

export async function updateMenuItem(
  id: string,
  data: MenuItemInput
): Promise<ActionResponse<MenuItem>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = menuItemSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return { success: false, error: firstError ?? "Invalid input" };
    }

    const existing = await db.menuItem.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Menu item not found" };

    const categoryExists = await db.category.findUnique({
      where: { id: parsed.data.categoryId },
    });
    if (!categoryExists) {
      return { success: false, error: "Category not found" };
    }

    const { variants, ...itemData } = parsed.data;

    const updated = await db.$transaction(async (tx) => {
      await tx.menuItem.update({
        where: { id },
        data: {
          ...itemData,
          basePrice: itemData.basePrice,
        },
      });

      const existingVariants = await tx.variant.findMany({
        where: { menuItemId: id },
      });

      const existingIds = variants
        .filter((v) => v.id)
        .map((v) => v.id as string);
      const toDelete = existingVariants.filter(
        (v) => !existingIds.includes(v.id)
      );

      for (const v of toDelete) {
        await tx.variant.delete({ where: { id: v.id } });
      }

      for (const variant of variants) {
        let variantId: string;

        if (variant.id) {
          await tx.variant.update({
            where: { id: variant.id },
            data: {
              name: variant.name,
              priceAdjust: variant.priceAdjust,
              available: variant.available,
            },
          });
          variantId = variant.id;

          await tx.addonOnVariant.deleteMany({
            where: { variantId },
          });
        } else {
          const created = await tx.variant.create({
            data: {
              menuItemId: id,
              name: variant.name,
              priceAdjust: variant.priceAdjust,
              available: variant.available,
            },
          });
          variantId = created.id;
        }

        if (variant.addonIds.length > 0) {
          await tx.addonOnVariant.createMany({
            data: variant.addonIds.map((addonId) => ({
              variantId,
              addonId,
            })),
          });
        }
      }

      return tx.menuItem.findUnique({
        where: { id },
        include: {
          category: true,
          variants: {
            include: {
              addons: { include: { addon: true } },
            },
          },
        },
      });
    });

    if (!updated) throw new Error("Failed to update menu item");

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "MenuItem",
        entityId: id,
        oldValues: existing,
        newValues: updated,
      },
    });

    return { success: true, data: updated };
  } catch (error) {
    console.error("updateMenuItem error:", error);
    return { success: false, error: "Failed to update menu item" };
  }
}

export async function deleteMenuItem(id: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const existing = await db.menuItem.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Menu item not found" };

    const orderCount = await db.orderItem.count({
      where: {
        menuItemId: id,
        order: { status: { notIn: ["CANCELLED"] } },
      },
    });
    if (orderCount > 0) {
      return {
        success: false,
        error: `Cannot delete menu item with ${orderCount} active order(s). Consider marking it as unavailable instead.`,
      };
    }

    await db.menuItem.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "MenuItem",
        entityId: id,
        oldValues: existing,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("deleteMenuItem error:", error);
    return { success: false, error: "Failed to delete menu item" };
  }
}
