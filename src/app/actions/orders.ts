"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/utils";
import { createJournalEntry } from "@/lib/accounting/engine";
import {
  cashSale,
  cashSaleWithTax,
  cardMobilePayment,
  saleWithDiscount,
} from "@/lib/accounting/templates";
import type { JournalLineInput } from "@/lib/accounting/validation";
import {
  createOrderSchema,
  paymentSchema,
  type CreateOrderInput,
  type PaymentInput,
} from "@/lib/validators/schemas";
import type { ActionResponse, PaginatedResponse } from "@/types";
import type { Order, OrderItem, Payment } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import type { Decimal } from "@prisma/client/runtime/client";

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderFilters {
  status?: string;
  orderType?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

type OrderWithRelations = Order & {
  items: (OrderItem & {
    addons: { id: string; addonId: string; name: string; price: Decimal }[];
  })[];
  table: { id: string; number: number; capacity: number; status: string; section: string | null } | null;
  customer: { id: string; name: string; phone: string | null; dueBalance: Decimal } | null;
  createdBy: { id: string; name: string; role: Role };
};

type OrderWithFullRelations = OrderWithRelations & {
  payments: Payment[];
  kots: { id: string; kotNumber: number; status: string; createdAt: Date }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CREATOR_ROLES: Role[] = ["ADMIN", "MANAGER", "CASHIER"];
const CANCELLER_ROLES: Role[] = ["ADMIN", "MANAGER"];

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

function paymentAccountCode(method: string): string {
  switch (method) {
    case "CASH":
      return "1000";
    case "CARD":
      return "1010";
    case "MOBILE":
      return "1020";
    case "BANK_TRANSFER":
      return "1010";
    default:
      return "1000";
  }
}

// ─── getOrders ────────────────────────────────────────────────────────────────

export async function getOrders(
  filters?: OrderFilters
): Promise<ActionResponse<PaginatedResponse<OrderWithRelations>>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.orderType) {
      where.type = filters.orderType;
    }
    if (filters?.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }
    if (filters?.dateFrom || filters?.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (filters.dateFrom) {
        createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        const toEnd = new Date(filters.dateTo);
        toEnd.setHours(23, 59, 59, 999);
        createdAt.lte = toEnd;
      }
      where.createdAt = createdAt;
    }
    if (filters?.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: "insensitive" } },
        { customer: { name: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          items: {
            include: {
              addons: true,
            },
          },
          table: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
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
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.order.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: items as OrderWithRelations[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("getOrders error:", error);
    return { success: false, error: "Failed to fetch orders" };
  }
}

// ─── getOrder ─────────────────────────────────────────────────────────────────

export async function getOrder(
  id: string
): Promise<ActionResponse<OrderWithFullRelations>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const order = await db.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            addons: true,
          },
        },
        table: true,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
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
        payments: true,
        kots: {
          select: {
            id: true,
            kotNumber: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return { success: false, error: "Order not found: " + id };
    }

    return { success: true, data: order as OrderWithFullRelations };
  } catch (error) {
    console.error("getOrder error:", error);
    return { success: false, error: "Failed to fetch order" };
  }
}

// ─── createOrder ──────────────────────────────────────────────────────────────

export async function createOrder(
  data: CreateOrderInput
): Promise<ActionResponse<Order>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, CREATOR_ROLES)) {
      return { success: false, error: "Insufficient permissions to create orders" };
    }

    const parsed = createOrderSchema.safeParse(data);
    if (!parsed.success) {
      const firstError =
        Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
        "Invalid order data";
      return { success: false, error: firstError };
    }

    const input = parsed.data;

    // Validate DINE_IN requires a table
    if (input.type === "DINE_IN" && !input.tableId) {
      return { success: false, error: "Table is required for dine-in orders" };
    }

    // Validate table if DINE_IN
    if (input.type === "DINE_IN" && input.tableId) {
      const table = await db.table.findUnique({
        where: { id: input.tableId },
      });
      if (!table) {
        return { success: false, error: "Table not found: " + input.tableId };
      }
      if (table.status !== "AVAILABLE") {
        return {
          success: false,
          error: "Table " + table.number + " is not available (status: " + table.status + ")",
        };
      }
    }

    // Validate customer if provided
    if (input.customerId) {
      const customer = await db.customer.findUnique({
        where: { id: input.customerId },
      });
      if (!customer) {
        return { success: false, error: "Customer not found: " + input.customerId };
      }
    }

    // Validate each item and calculate unit prices
    const validatedItems: {
      menuItemId: string;
      variantId: string | null;
      name: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      addons: { addonId: string; name: string; price: number }[];
      notes: string | undefined;
    }[] = [];

    for (const item of input.items) {
      const menuItem = await db.menuItem.findUnique({
        where: { id: item.menuItemId },
        include: {
          variants: true,
        },
      });

      if (!menuItem) {
        return { success: false, error: "Menu item not found: " + item.menuItemId };
      }
      if (!menuItem.available) {
        return {
          success: false,
          error: "Menu item is unavailable: " + menuItem.name,
        };
      }

      // Validate variant if provided
      let variantAdjust = 0;
      if (item.variantId) {
        const variant = await db.variant.findUnique({
          where: { id: item.variantId },
        });
        if (!variant) {
          return { success: false, error: "Variant not found: " + item.variantId };
        }
        if (!variant.available) {
          return {
            success: false,
            error: "Variant is unavailable: " + variant.name,
          };
        }
        if (variant.menuItemId !== item.menuItemId) {
          return {
            success: false,
            error: "Variant " + variant.name + " does not belong to menu item: " + menuItem.name,
          };
        }
        variantAdjust = Number(variant.priceAdjust);
      }

      // Validate addons
      let addonTotal = 0;
      const validatedAddons: { addonId: string; name: string; price: number }[] = [];

      for (const addon of item.addons) {
        const addonRecord = await db.addon.findUnique({
          where: { id: addon.addonId },
        });
        if (!addonRecord) {
          return { success: false, error: "Addon not found: " + addon.addonId };
        }
        if (!addonRecord.available) {
          return {
            success: false,
            error: "Addon is unavailable: " + addonRecord.name,
          };
        }

        // If variant is specified, verify addon is compatible
        if (item.variantId) {
          const compatible = await db.addonOnVariant.findUnique({
            where: {
              variantId_addonId: {
                variantId: item.variantId,
                addonId: addon.addonId,
              },
            },
          });
          if (!compatible) {
            return {
              success: false,
              error: "Addon " + addonRecord.name + " is not available for the selected variant",
            };
          }
        }

        const addonPrice = Number(addonRecord.price);
        addonTotal += addonPrice;
        validatedAddons.push({
          addonId: addonRecord.id,
          name: addonRecord.name,
          price: addonPrice,
        });
      }

      const unitPrice = Number(menuItem.basePrice) + variantAdjust + addonTotal;

      validatedItems.push({
        menuItemId: menuItem.id,
        variantId: item.variantId ?? null,
        name: item.name,
        quantity: item.quantity,
        unitPrice,
        discount: item.discount,
        addons: validatedAddons,
        notes: item.notes,
      });
    }

    // Calculate totals
    let orderSubtotal = 0;
    const itemSubtotals = validatedItems.map((item) => {
      const lineTotal = item.unitPrice * item.quantity - item.discount;
      orderSubtotal += lineTotal;
      return lineTotal;
    });

    const taxAmount = orderSubtotal * (input.taxRate / 100);
    const grandTotal = orderSubtotal - input.discountAmount + taxAmount;

    if (input.discountAmount > orderSubtotal) {
      return { success: false, error: "Discount cannot exceed order subtotal" };
    }

    if (input.taxRate > 100) {
      return { success: false, error: "Tax rate cannot exceed 100%" };
    }

    if (grandTotal < 0) {
      return { success: false, error: "Grand total cannot be negative" };
    }

    // Execute transaction
    const order = await db.$transaction(async (tx: TransactionClient) => {
      // Count today's orders for sequence number
      const todayCount = await tx.order.count({
        where: {
          createdAt: {
            gte: todayStart(),
            lt: todayEnd(),
          },
        },
      });
      const sequence = todayCount + 1;
      const orderNumber = generateOrderNumber(sequence);

      // Create order with items
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          type: input.type,
          tableId: input.tableId ?? null,
          customerId: input.customerId ?? null,
          status: "PENDING",
          subtotal: orderSubtotal,
          discountAmount: input.discountAmount,
          taxRate: input.taxRate,
          taxAmount,
          grandTotal,
          paymentStatus: "UNPAID",
          notes: input.notes ?? null,
          createdById: session.user.id,
          items: {
            create: validatedItems.map((item, index) => ({
              menuItemId: item.menuItemId,
              variantId: item.variantId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              subtotal: itemSubtotals[index],
              addons: {
                create: item.addons.map((addon) => ({
                  addonId: addon.addonId,
                  name: addon.name,
                  price: addon.price,
                })),
              },
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Update table to OCCUPIED if DINE_IN
      if (input.type === "DINE_IN" && input.tableId) {
        await tx.table.update({
          where: { id: input.tableId },
          data: { status: "OCCUPIED" },
        });
      }

      // Update customer dueBalance for credit orders
      if (input.customerId) {
        await tx.customer.update({
          where: { id: input.customerId },
          data: {
            dueBalance: {
              increment: grandTotal,
            },
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "Order",
          entityId: createdOrder.id,
          newValues: {
            orderNumber: createdOrder.orderNumber,
            type: createdOrder.type,
            grandTotal: createdOrder.grandTotal,
            itemCount: validatedItems.length,
          },
        },
      });

      // Generate KOT for kitchen
      await tx.kOT.create({
        data: {
          orderId: createdOrder.id,
          kotNumber: 1,
          status: "PENDING",
          items: {
            create: createdOrder.items.map((item, index) => ({
              orderItemId: item.id,
              name: item.name,
              quantity: item.quantity,
              addons: validatedItems[index]?.addons.map((a) => a.name).join(", ") || null,
              notes: validatedItems[index]?.notes ?? null,
              status: "PENDING",
            })),
          },
        },
      });

      // Update order status to CONFIRMED after KOT is generated
      await tx.order.update({
        where: { id: createdOrder.id },
        data: { status: "CONFIRMED" },
      });

      return createdOrder;
    });

    return { success: true, data: order };
  } catch (error) {
    console.error("createOrder error:", error);
    return { success: false, error: "Failed to create order" };
  }
}

// ─── processPayment ───────────────────────────────────────────────────────────

export async function processPayment(
  data: PaymentInput
): Promise<ActionResponse<Payment>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, CREATOR_ROLES)) {
      return { success: false, error: "Insufficient permissions to process payments" };
    }

    const parsed = paymentSchema.safeParse(data);
    if (!parsed.success) {
      const firstError =
        Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
        "Invalid payment data";
      return { success: false, error: firstError };
    }

    const input = parsed.data;

    // Load accounts for journal entries
    const accountCodes = [
      "1000", "1010", "1020", "4000", "2100", "4100",
    ];
    const accountMap = await getAccountIdsByCode(accountCodes);

    const payment = await db.$transaction(async (tx: TransactionClient) => {
      // Verify order exists
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: {
          payments: true,
          customer: true,
          table: true,
        },
      });

      if (!order) {
        throw new Error("Order not found: " + input.orderId);
      }

      if (order.status === "CANCELLED") {
        throw new Error("Cannot process payment for a cancelled order");
      }

      if (order.status === "COMPLETED" && order.paymentStatus === "PAID") {
        throw new Error("Order is already fully paid");
      }

      // Duplicate protection: same orderId + method + amount within last 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const duplicate = await tx.payment.findFirst({
        where: {
          orderId: input.orderId,
          method: input.method,
          amount: input.amount,
          createdAt: {
            gte: twoMinutesAgo,
          },
        },
      });

      if (duplicate) {
        throw new Error(
          "Potential duplicate payment detected (same order, method, and amount within 2 minutes). Payment ID: " +
            duplicate.id
        );
      }

      // Create payment record
      const createdPayment = await tx.payment.create({
        data: {
          orderId: input.orderId,
          method: input.method,
          amount: input.amount,
          reference: input.reference ?? null,
          receivedById: session.user.id,
        },
      });

      // Calculate total paid
      const totalPaid = order.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      ) + input.amount;

      const grandTotal = Number(order.grandTotal);

      // Overpayment protection
      const previouslyPaid = order.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );
      if (previouslyPaid + input.amount > grandTotal) {
        throw new Error("Payment amount exceeds order total");
      }

      // Determine payment status
      let paymentStatus: string;
      let newOrderStatus: string | undefined;

      if (totalPaid >= grandTotal) {
        paymentStatus = "PAID";
        newOrderStatus = "COMPLETED";
      } else if (totalPaid > 0) {
        paymentStatus = "PARTIAL";
      } else {
        paymentStatus = "UNPAID";
      }

      // Update order
      const updateData: Record<string, unknown> = {
        paymentStatus,
      };
      if (newOrderStatus) {
        updateData.status = newOrderStatus;
      }

      await tx.order.update({
        where: { id: input.orderId },
        data: updateData,
      });

      // If DINE_IN order is now COMPLETED, set table to AVAILABLE
      if (
        newOrderStatus === "COMPLETED" &&
        order.type === "DINE_IN" &&
        order.tableId
      ) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: "AVAILABLE" },
        });
      }

      // Update customer dueBalance if applicable
      if (order.customerId && paymentStatus !== "UNPAID") {
        const paidAmount = Math.min(input.amount, grandTotal - (totalPaid - input.amount));
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            dueBalance: {
              decrement: paidAmount,
            },
          },
        });
      }

      // Create journal entry for accounting
      try {
        const pAccountCode = paymentAccountCode(input.method);
        const pAccountId = accountMap.get(pAccountCode);
        const salesAccountId = accountMap.get("4000");
        const taxAccountId = accountMap.get("2100");

        if (pAccountId && salesAccountId) {
          const orderSubtotal = Number(order.subtotal);
          const orderTaxAmount = Number(order.taxAmount);
          const orderDiscountAmount = Number(order.discountAmount);
          const paymentAmount = input.amount;

          let lines: JournalLineInput[];

          const isFullPayment = totalPaid >= grandTotal;

          if (orderDiscountAmount > 0 && orderTaxAmount > 0 && taxAccountId && isFullPayment) {
            const discountAccountId = accountMap.get("4100");
            lines = [
              { accountId: pAccountId, debit: paymentAmount, credit: 0 },
              ...(discountAccountId ? [{ accountId: discountAccountId, debit: orderDiscountAmount, credit: 0 }] : []),
              { accountId: salesAccountId, debit: 0, credit: orderSubtotal },
              ...(taxAccountId ? [{ accountId: taxAccountId, debit: 0, credit: orderTaxAmount }] : []),
            ];
          } else if (orderDiscountAmount > 0 && isFullPayment) {
            lines = saleWithDiscount(
              orderSubtotal,
              orderDiscountAmount,
              paymentAmount,
              pAccountId
            );
          } else if (orderTaxAmount > 0 && taxAccountId) {
            const taxProportion = orderTaxAmount / (orderSubtotal + orderTaxAmount);
            const taxPortion = Math.round(paymentAmount * taxProportion * 100) / 100;
            const revenuePortion = Math.round((paymentAmount - taxPortion) * 100) / 100;
            lines = cashSaleWithTax(revenuePortion, taxPortion, pAccountId);
          } else {
            if (input.method === "CASH") {
              lines = cashSale(paymentAmount, pAccountId);
            } else {
              lines = cardMobilePayment(paymentAmount, pAccountId);
            }
          }

          // Map account code strings to database IDs
          lines = lines.map((l) => {
            const resolvedId = accountMap.get(l.accountId);
            if (!resolvedId) {
              throw new Error("Account not found for code: " + l.accountId);
            }
            return { ...l, accountId: resolvedId };
          });

          await createJournalEntry({
            description: "Payment for order " + order.orderNumber,
            referenceType: "PAYMENT",
            referenceId: createdPayment.id,
            userId: session.user.id,
            lines,
          });
        }
      } catch (journalError) {
        console.error("Failed to create journal entry for payment:", journalError);
        // Don't fail the payment if journal entry fails; log and continue
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "Payment",
          entityId: createdPayment.id,
          newValues: {
            orderId: input.orderId,
            method: input.method,
            amount: input.amount,
            paymentStatus,
          },
        },
      });

      return createdPayment;
    });

    return { success: true, data: payment };
  } catch (error) {
    console.error("processPayment error:", error);
    return { success: false, error: "Failed to process payment. Please try again." };
  }
}

// ─── cancelOrder ──────────────────────────────────────────────────────────────

export async function cancelOrder(
  id: string,
  reason: string
): Promise<ActionResponse<Order>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, CANCELLER_ROLES)) {
      return { success: false, error: "Only admins and managers can cancel orders" };
    }

    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "Cancellation reason is required" };
    }

    const order = await db.$transaction(async (tx: TransactionClient) => {
      const existingOrder = await tx.order.findUnique({
        where: { id },
        include: { table: true, customer: true },
      });

      if (!existingOrder) {
        throw new Error("Order not found: " + id);
      }

      if (
        existingOrder.status !== "PENDING" &&
        existingOrder.status !== "CONFIRMED"
      ) {
        throw new Error(
          "Cannot cancel order in " + existingOrder.status + " status. Only PENDING or CONFIRMED orders can be cancelled."
        );
      }

      const previousStatus = existingOrder.status;

      // Update order status to CANCELLED
      const cancelledOrder = await tx.order.update({
        where: { id },
        data: {
          status: "CANCELLED",
          paymentStatus: "UNPAID",
        },
      });

      // If DINE_IN, set table back to AVAILABLE
      if (existingOrder.type === "DINE_IN" && existingOrder.tableId) {
        await tx.table.update({
          where: { id: existingOrder.tableId },
          data: { status: "AVAILABLE" },
        });
      }

      // Reverse customer dueBalance if applicable
      if (existingOrder.customerId) {
        await tx.customer.update({
          where: { id: existingOrder.customerId },
          data: {
            dueBalance: {
              decrement: Number(existingOrder.grandTotal),
            },
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entity: "Order",
          entityId: id,
          oldValues: {
            status: previousStatus,
            paymentStatus: existingOrder.paymentStatus,
          },
          newValues: {
            status: "CANCELLED",
            paymentStatus: "UNPAID",
            reason,
          },
        },
      });

      return cancelledOrder;
    });

    return { success: true, data: order };
  } catch (error) {
    console.error("cancelOrder error:", error);
    return { success: false, error: "Failed to cancel order. Please try again." };
  }
}
