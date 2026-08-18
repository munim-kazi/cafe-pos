"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { ActionResponse } from "@/types";
import type { Role } from "@/generated/prisma/enums";
import type { KOT, KOTItem } from "@/generated/prisma/client";

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

// ─── Types ────────────────────────────────────────────────────────────────────

interface KitchenOrder {
  id: string;
  kotNumber: number;
  status: string;
  notes: string | null;
  createdAt: Date;
  order: {
    id: string;
    orderNumber: string;
    type: string;
    table: { number: number; section: string | null } | null;
  };
  items: {
    id: string;
    name: string;
    quantity: number;
    addons: string | null;
    notes: string | null;
    status: string;
  }[];
}

const VALID_STATUS_FLOW = ["PENDING", "IN_PROGRESS", "READY", "SERVED"] as const;

type ValidStatus = (typeof VALID_STATUS_FLOW)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasRole(userRole: Role, allowed: Role[]): boolean {
  return allowed.includes(userRole);
}

function isValidTransition(from: string, to: string): boolean {
  const fromIdx = VALID_STATUS_FLOW.indexOf(from as ValidStatus);
  const toIdx = VALID_STATUS_FLOW.indexOf(to as ValidStatus);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1;
}

async function createAuditLog(
  tx: TransactionClient,
  userId: string,
  action: "CREATE" | "UPDATE",
  entity: string,
  entityId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  newValues: Record<string, any>
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      newValues: newValues as never,
      createdAt: new Date(),
    },
  });
}

// ─── generateKOT ──────────────────────────────────────────────────────────────

export async function generateKOT(
  orderId: string
): Promise<ActionResponse<KOT & { items: KOTItem[] }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            addons: true,
          },
        },
      },
    });

    if (!order) {
      return { success: false, error: "Order not found: " + orderId };
    }

    const existingKots = await db.kOT.count({
      where: { orderId },
    });

    const nextKotNumber = existingKots + 1;

    const result = await db.$transaction(async (tx) => {
      const kot = await tx.kOT.create({
        data: {
          orderId,
          kotNumber: nextKotNumber,
          status: "PENDING",
        },
      });

      const kotItems = await Promise.all(
        order.items.map((item) => {
          const addonNames = item.addons.map((a) => a.name).join(", ") || null;
          return tx.kOTItem.create({
            data: {
              kotId: kot.id,
              orderItemId: item.id,
              name: item.name,
              quantity: item.quantity,
              addons: addonNames,
              notes: item.unitPrice ? null : null,
              status: "PENDING",
            },
          });
        })
      );

      await tx.order.update({
        where: { id: orderId },
        data: { status: "CONFIRMED" },
      });

      await createAuditLog(tx, session.user.id, "CREATE", "KOT", kot.id, {
        orderId,
        kotNumber: nextKotNumber,
        itemCount: order.items.length,
      });

      return { ...kot, items: kotItems };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("generateKOT error:", error);
    return { success: false, error: "Failed to generate KOT" };
  }
}

// ─── getKitchenOrders ─────────────────────────────────────────────────────────

export async function getKitchenOrders(): Promise<ActionResponse<KitchenOrder[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const kots = await db.kOT.findMany({
      where: {
        order: {
          status: {
            in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "READY"],
          },
        },
      },
      include: {
        items: true,
        order: {
          include: {
            table: {
              select: {
                number: true,
                section: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const kitchenOrders: KitchenOrder[] = kots.map((kot) => ({
      id: kot.id,
      kotNumber: kot.kotNumber,
      status: kot.status,
      notes: kot.notes,
      createdAt: kot.createdAt,
      order: {
        id: kot.order.id,
        orderNumber: kot.order.orderNumber,
        type: kot.order.type,
        table: kot.order.table,
      },
      items: kot.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        addons: item.addons,
        notes: item.notes,
        status: item.status,
      })),
    }));

    return { success: true, data: kitchenOrders };
  } catch (error) {
    console.error("getKitchenOrders error:", error);
    return { success: false, error: "Failed to fetch kitchen orders" };
  }
}

// ─── updateKOTStatus ──────────────────────────────────────────────────────────

export async function updateKOTStatus(
  kotId: string,
  status: "IN_PROGRESS" | "READY" | "SERVED"
): Promise<ActionResponse<KOT>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const kot = await db.kOT.findUnique({
      where: { id: kotId },
    });

    if (!kot) {
      return { success: false, error: "KOT not found: " + kotId };
    }

    if (status === "IN_PROGRESS" || status === "READY") {
      if (!hasRole(session.user.role, ["KITCHEN"])) {
        return {
          success: false,
          error: "Only kitchen staff can update to " + status,
        };
      }
    }

    if (status === "SERVED") {
      if (!hasRole(session.user.role, ["CASHIER", "MANAGER", "ADMIN"])) {
        return {
          success: false,
          error: "Only cashier, manager, or admin can mark as served",
        };
      }
    }

    if (!isValidTransition(kot.status, status)) {
      return {
        success: false,
        error:
          "Invalid status transition from " +
          kot.status +
          " to " +
          status,
      };
    }

    const result = await db.$transaction(async (tx) => {
      const updatedKot = await tx.kOT.update({
        where: { id: kotId },
        data: { status },
      });

      await tx.kOTItem.updateMany({
        where: { kotId },
        data: { status },
      });

      await createAuditLog(tx, session.user.id, "UPDATE", "KOT", kotId, {
        oldStatus: kot.status,
        newStatus: status,
      });

      return updatedKot;
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("updateKOTStatus error:", error);
    return { success: false, error: "Failed to update KOT status" };
  }
}

// ─── updateKOTItemStatus ──────────────────────────────────────────────────────

export async function updateKOTItemStatus(
  kotItemId: string,
  status: "IN_PROGRESS" | "READY" | "SERVED"
): Promise<ActionResponse<KOTItem>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const kotItem = await db.kOTItem.findUnique({
      where: { id: kotItemId },
      include: { kot: true },
    });

    if (!kotItem) {
      return { success: false, error: "KOT item not found: " + kotItemId };
    }

    if (status === "IN_PROGRESS" || status === "READY") {
      if (!hasRole(session.user.role, ["KITCHEN"])) {
        return {
          success: false,
          error: "Only kitchen staff can update to " + status,
        };
      }
    }

    if (status === "SERVED") {
      if (!hasRole(session.user.role, ["CASHIER"])) {
        return {
          success: false,
          error: "Only cashier can mark items as served",
        };
      }
    }

    if (!isValidTransition(kotItem.status, status)) {
      return {
        success: false,
        error:
          "Invalid status transition from " +
          kotItem.status +
          " to " +
          status,
      };
    }

    const result = await db.$transaction(async (tx) => {
      const updatedItem = await tx.kOTItem.update({
        where: { id: kotItemId },
        data: { status },
      });

      const allItems = await tx.kOTItem.findMany({
        where: { kotId: kotItem.kotId },
      });

      const allAtTarget = allItems.every((item) => {
        if (item.id === kotItemId) return true;
        return item.status === status;
      });

      if (allAtTarget) {
        await tx.kOT.update({
          where: { id: kotItem.kotId },
          data: { status },
        });
      }

      await createAuditLog(tx, session.user.id, "UPDATE", "KOTItem", kotItemId, {
        oldStatus: kotItem.status,
        newStatus: status,
      });

      return updatedItem;
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("updateKOTItemStatus error:", error);
    return { success: false, error: "Failed to update KOT item status" };
  }
}

// ─── getKOTsByOrder ───────────────────────────────────────────────────────────

export async function getKOTsByOrder(
  orderId: string
): Promise<ActionResponse<(KOT & { items: KOTItem[] })[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const kots = await db.kOT.findMany({
      where: { orderId },
      include: {
        items: true,
      },
      orderBy: { kotNumber: "desc" },
    });

    return { success: true, data: kots };
  } catch (error) {
    console.error("getKOTsByOrder error:", error);
    return { success: false, error: "Failed to fetch KOTs" };
  }
}
