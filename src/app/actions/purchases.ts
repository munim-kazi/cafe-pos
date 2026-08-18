"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generatePurchaseNumber } from "@/lib/utils";
import { createJournalEntry } from "@/lib/accounting/engine";
import { cashPurchase, creditPurchase, paySupplier } from "@/lib/accounting/templates";
import type { JournalLineInput } from "@/lib/accounting/validation";
import type { ActionResponse, PaginatedResponse } from "@/types";
import type { Purchase, PurchaseItem, Supplier } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import type { Decimal } from "@prisma/client/runtime/client";

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseFilters {
  status?: string;
  supplierId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

type PurchaseWithRelations = Purchase & {
  supplier: { id: string; name: string; company: string | null; dueBalance: unknown };
  createdBy: { id: string; name: string; role: Role };
  _count: { items: number };
};

type PurchaseWithFullRelations = Purchase & {
  supplier: Supplier;
  createdBy: { id: string; name: string; role: Role };
  items: (PurchaseItem & {
    ingredient: { id: string; name: string; unit: string; currentStock: unknown };
  })[];
};

type SupplierWithOutstanding = Supplier & {
  purchases: {
    id: string;
    purchaseNumber: string;
    total: Decimal;
    paidAmount: Decimal;
    date: Date;
  }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MANAGER_ROLES: Role[] = ["ADMIN", "MANAGER"];

function hasRole(userRole: Role, allowed: Role[]): boolean {
  return allowed.includes(userRole);
}

function todayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function todayEnd(): Date {
  const start = todayStart();
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

async function getAccountIdsByCode(
  codes: string[]
): Promise<Map<string, string>> {
  const accounts = await db.account.findMany({
    where: { code: { in: codes } },
    select: { code: true, id: true },
  });
  return new Map(accounts.map((a) => [a.code, a.id]));
}

// ─── getPurchases ─────────────────────────────────────────────────────────────

export async function getPurchases(
  params?: PurchaseFilters
): Promise<ActionResponse<PaginatedResponse<PurchaseWithRelations>>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, MANAGER_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (params?.status) {
      where.status = params.status;
    }
    if (params?.supplierId) {
      where.supplierId = params.supplierId;
    }
    if (params?.search) {
      where.purchaseNumber = { contains: params.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      db.purchase.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              company: true,
              dueBalance: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.purchase.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: items as PurchaseWithRelations[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("getPurchases error:", error);
    return { success: false, error: "Failed to fetch purchases" };
  }
}

// ─── getPurchase ──────────────────────────────────────────────────────────────

export async function getPurchase(
  id: string
): Promise<ActionResponse<PurchaseWithFullRelations>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const purchase = await db.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        items: {
          include: {
            ingredient: {
              select: {
                id: true,
                name: true,
                unit: true,
                currentStock: true,
              },
            },
          },
        },
      },
    });

    if (!purchase) {
      return { success: false, error: "Purchase not found" };
    }

    return { success: true, data: purchase as PurchaseWithFullRelations };
  } catch (error) {
    console.error("getPurchase error:", error);
    return { success: false, error: "Failed to fetch purchase" };
  }
}

// ─── createPurchase ───────────────────────────────────────────────────────────

interface CreatePurchaseInput {
  supplierId: string;
  items: { ingredientId: string; quantity: number; unitCost: number }[];
  isCredit?: boolean;
  paidAmount?: number;
  notes?: string;
}

export async function createPurchase(
  data: CreatePurchaseInput
): Promise<ActionResponse<Purchase>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, MANAGER_ROLES)) {
      return { success: false, error: "Insufficient permissions to create purchases" };
    }

    const supplier = await db.supplier.findUnique({
      where: { id: data.supplierId },
    });
    if (!supplier) {
      return { success: false, error: "Supplier not found" };
    }

    if (!data.items || data.items.length === 0) {
      return { success: false, error: "At least one item is required" };
    }

    const validatedItems: {
      ingredientId: string;
      quantity: number;
      unitCost: number;
      total: number;
    }[] = [];

    for (const item of data.items) {
      if (item.quantity <= 0) {
        return {
          success: false,
          error: "Quantity must be positive for ingredient " + item.ingredientId,
        };
      }
      if (item.unitCost <= 0) {
        return {
          success: false,
          error: "Unit cost must be positive for ingredient " + item.ingredientId,
        };
      }

      const ingredient = await db.ingredient.findUnique({
        where: { id: item.ingredientId },
      });
      if (!ingredient) {
        return {
          success: false,
          error: "Ingredient not found: " + item.ingredientId,
        };
      }

      const itemTotal = item.quantity * item.unitCost;
      validatedItems.push({
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        total: itemTotal,
      });
    }

    const subtotal = validatedItems.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal;

    const isCredit = data.isCredit ?? false;
    const purchasePaidAmount = isCredit ? (data.paidAmount ?? 0) : total;

    if (!isCredit && purchasePaidAmount !== total) {
      return {
        success: false,
        error: "Paid amount must equal total for non-credit purchases",
      };
    }

    if (isCredit && data.paidAmount !== undefined && data.paidAmount > total) {
      return { success: false, error: "Paid amount cannot exceed total" };
    }

    const accountCodes = ["1000", "1200", "2000"];
    const accountMap = await getAccountIdsByCode(accountCodes);

    const purchase = await db.$transaction(async (tx: TransactionClient) => {
      const todayCount = await tx.purchase.count({
        where: {
          createdAt: {
            gte: todayStart(),
            lt: todayEnd(),
          },
        },
      });
      const sequence = todayCount + 1;
      const purchaseNumber = generatePurchaseNumber(sequence);

      const createdPurchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: data.supplierId,
          subtotal,
          taxAmount: 0,
          total,
          isCredit,
          paidAmount: purchasePaidAmount,
          status: "DRAFT",
          notes: data.notes ?? null,
          createdById: session.user.id,
          items: {
            create: validatedItems.map((item) => ({
              ingredientId: item.ingredientId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              total: item.total,
            })),
          },
        },
        include: { items: true },
      });

      const unpaidAmount = total - purchasePaidAmount;
      if (isCredit && unpaidAmount > 0) {
        await tx.supplier.update({
          where: { id: data.supplierId },
          data: {
            dueBalance: {
              increment: unpaidAmount,
            },
          },
        });
      }

      try {
        const inventoryAccountId = accountMap.get("1200");
        const cashAccountId = accountMap.get("1000");
        const apAccountId = accountMap.get("2000");

        if (inventoryAccountId) {
          let lines: JournalLineInput[];

          if (isCredit && apAccountId) {
            lines = creditPurchase(total);
          } else if (cashAccountId) {
            lines = cashPurchase(total);
          } else {
            throw new Error("Required accounts not found");
          }

          lines = lines.map((l) => {
            const resolvedId = accountMap.get(l.accountId);
            if (!resolvedId) {
              throw new Error("Account not found for code: " + l.accountId);
            }
            return { ...l, accountId: resolvedId };
          });

          await createJournalEntry({
            description: "Purchase " + purchaseNumber,
            referenceType: "PURCHASE",
            referenceId: createdPurchase.id,
            userId: session.user.id,
            lines,
          });
        }
      } catch (journalError) {
        console.error("Failed to create journal entry for purchase:", journalError);
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "Purchase",
          entityId: createdPurchase.id,
          newValues: {
            purchaseNumber: createdPurchase.purchaseNumber,
            supplierId: data.supplierId,
            total,
            isCredit,
            itemCount: validatedItems.length,
          },
        },
      });

      return createdPurchase;
    });

    return { success: true, data: purchase };
  } catch (error) {
    console.error("createPurchase error:", error);
    return { success: false, error: "Failed to create purchase. Please try again." };
  }
}

// ─── receivePurchase ──────────────────────────────────────────────────────────

export async function receivePurchase(
  id: string
): Promise<ActionResponse<Purchase>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, MANAGER_ROLES)) {
      return { success: false, error: "Insufficient permissions to receive purchases" };
    }

    const purchase = await db.$transaction(async (tx: TransactionClient) => {
      const existing = await tx.purchase.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existing) {
        throw new Error("Purchase not found");
      }

      if (existing.status !== "DRAFT") {
        throw new Error(
          "Only DRAFT purchases can be received. Current status: " + existing.status
        );
      }

      const updatedPurchase = await tx.purchase.update({
        where: { id },
        data: { status: "RECEIVED" },
      });

      for (const item of existing.items) {
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            currentStock: {
              increment: item.quantity,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            ingredientId: item.ingredientId,
            type: "PURCHASE",
            quantity: item.quantity,
            unitCost: item.unitCost,
            referenceType: "PURCHASE",
            referenceId: existing.id,
            notes: "Received " + existing.purchaseNumber,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entity: "Purchase",
          entityId: id,
          oldValues: { status: "DRAFT" },
          newValues: { status: "RECEIVED" },
        },
      });

      return updatedPurchase;
    });

    return { success: true, data: purchase };
  } catch (error) {
    console.error("receivePurchase error:", error);
    return { success: false, error: "Failed to receive purchase. Please try again." };
  }
}

// ─── cancelPurchase ───────────────────────────────────────────────────────────

export async function cancelPurchase(
  id: string
): Promise<ActionResponse<Purchase>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, MANAGER_ROLES)) {
      return { success: false, error: "Insufficient permissions to cancel purchases" };
    }

    const purchase = await db.$transaction(async (tx: TransactionClient) => {
      const existing = await tx.purchase.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existing) {
        throw new Error("Purchase not found");
      }

      if (existing.status !== "DRAFT" && existing.status !== "RECEIVED") {
        throw new Error(
          "Only DRAFT or RECEIVED purchases can be cancelled. Current status: " + existing.status
        );
      }

      const updatedPurchase = await tx.purchase.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      if (existing.isCredit) {
        const unpaidAmount = Number(existing.total) - Number(existing.paidAmount);
        if (unpaidAmount > 0) {
          await tx.supplier.update({
            where: { id: existing.supplierId },
            data: {
              dueBalance: {
                decrement: unpaidAmount,
              },
            },
          });
        }
      }

      if (existing.status === "RECEIVED") {
        for (const item of existing.items) {
          await tx.ingredient.update({
            where: { id: item.ingredientId },
            data: {
              currentStock: {
                decrement: item.quantity,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              ingredientId: item.ingredientId,
              type: "RETURN",
              quantity: -item.quantity,
              unitCost: item.unitCost,
              referenceType: "PURCHASE",
              referenceId: existing.id,
              notes: "Reversal for cancelled purchase " + existing.purchaseNumber,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entity: "Purchase",
          entityId: id,
          oldValues: { status: "DRAFT", isCredit: existing.isCredit },
          newValues: { status: "CANCELLED" },
        },
      });

      return updatedPurchase;
    });

    return { success: true, data: purchase };
  } catch (error) {
    console.error("cancelPurchase error:", error);
    return { success: false, error: "Failed to cancel purchase. Please try again." };
  }
}

// ─── getSupplierPayments ──────────────────────────────────────────────────────

export async function getSupplierPayments(
  params?: { supplierId?: string; page?: number; pageSize?: number }
): Promise<ActionResponse<PaginatedResponse<SupplierWithOutstanding>>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {
      dueBalance: { gt: 0 },
    };

    if (params?.supplierId) {
      where.id = params.supplierId;
    }

    const [suppliers, total] = await Promise.all([
      db.supplier.findMany({
        where,
        include: {
          purchases: {
            where: {
              isCredit: true,
              status: { in: ["DRAFT", "RECEIVED"] },
            },
            select: {
              id: true,
              purchaseNumber: true,
              total: true,
              paidAmount: true,
              date: true,
            },
            orderBy: { date: "asc" },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
      }),
      db.supplier.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: suppliers as SupplierWithOutstanding[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("getSupplierPayments error:", error);
    return { success: false, error: "Failed to fetch supplier payments" };
  }
}

// ─── processSupplierPayment ───────────────────────────────────────────────────

export async function processSupplierPayment(
  supplierId: string,
  data: { amount: number; reference?: string }
): Promise<ActionResponse<{ paid: number; remaining: number }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, MANAGER_ROLES)) {
      return {
        success: false,
        error: "Insufficient permissions to process supplier payments",
      };
    }

    const supplier = await db.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) {
      return { success: false, error: "Supplier not found" };
    }

    if (data.amount <= 0) {
      return { success: false, error: "Payment amount must be positive" };
    }

    if (data.amount > Number(supplier.dueBalance)) {
      return {
        success: false,
        error:
          "Payment amount (" +
          data.amount +
          ") exceeds supplier due balance (" +
          supplier.dueBalance +
          ")",
      };
    }

    // Duplicate payment protection — 2-minute window
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentDuplicate = await db.journalEntry.findFirst({
      where: {
        referenceType: "SUPPLIER_PAYMENT",
        referenceId: { startsWith: supplierId + "_" },
        createdAt: { gte: twoMinutesAgo },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recentDuplicate) {
      return { success: false, error: "Duplicate payment detected. Please wait before submitting again." };
    }

    const accountCodes = ["1000", "2000"];
    const accountMap = await getAccountIdsByCode(accountCodes);

    const result = await db.$transaction(async (tx: TransactionClient) => {
      // Find all credit purchases with outstanding balance (oldest first)
      const allPurchases = await tx.purchase.findMany({
        where: {
          supplierId,
          isCredit: true,
          status: { in: ["DRAFT", "RECEIVED"] },
        },
        orderBy: { date: "asc" },
      });

      const unpaidPurchases = allPurchases.filter(
        (p) => Number(p.paidAmount) < Number(p.total)
      );

      if (unpaidPurchases.length === 0) {
        throw new Error("No outstanding purchases found for this supplier");
      }

      let remainingPayment = data.amount;

      for (const purchase of unpaidPurchases) {
        if (remainingPayment <= 0) break;

        const purchaseDue =
          Number(purchase.total) - Number(purchase.paidAmount);
        const applied = Math.min(remainingPayment, purchaseDue);

        await tx.purchase.update({
          where: { id: purchase.id },
          data: {
            paidAmount: {
              increment: applied,
            },
          },
        });

        remainingPayment -= applied;
      }

      // Reduce supplier dueBalance
      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          dueBalance: {
            decrement: data.amount,
          },
        },
      });

      // Create journal entry
      try {
        const apAccountId = accountMap.get("2000");
        const cashAccountId = accountMap.get("1000");

        if (apAccountId && cashAccountId) {
          let lines = paySupplier(data.amount, cashAccountId);
          lines = lines.map((l) => {
            const resolvedId = accountMap.get(l.accountId);
            if (!resolvedId) {
              throw new Error("Account not found for code: " + l.accountId);
            }
            return { ...l, accountId: resolvedId };
          });

          await createJournalEntry({
            description:
              "Payment to supplier " +
              supplier.name +
              (data.reference ? " (Ref: " + data.reference + ")" : ""),
            referenceType: "SUPPLIER_PAYMENT",
            referenceId: supplierId + "_" + Date.now(),
            userId: session.user.id,
            lines,
          });
        }
      } catch (journalError) {
        console.error(
          "Failed to create journal entry for supplier payment:",
          journalError
        );
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "SupplierPayment",
          entityId: supplierId,
          newValues: {
            supplierId,
            amount: data.amount,
            reference: data.reference ?? null,
          },
        },
      });

      const finalSupplier = await tx.supplier.findUnique({
        where: { id: supplierId },
      });

      return {
        paid: data.amount,
        remaining: Number(finalSupplier?.dueBalance ?? 0),
      };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("processSupplierPayment error:", error);
    return { success: false, error: "Failed to process supplier payment. Please try again." };
  }
}
