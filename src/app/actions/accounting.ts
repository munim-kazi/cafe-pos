"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createJournalEntry, reverseJournalEntry } from "@/lib/accounting/engine";
import {
  customerPayment,
  fullRefund,
  partialRefund,
  expense as expenseTemplate,
} from "@/lib/accounting/templates";
import type { JournalLineInput } from "@/lib/accounting/validation";
import type { ActionResponse, PaginatedResponse } from "@/types";
import type {
  Account,
  JournalEntry,
  JournalLine,
  AccountBalance,
  AccountsReceivable,
  AccountsPayable,
  Refund,
  Expense,
} from "@/generated/prisma/client";
import type { Role, AccountType } from "@/generated/prisma/enums";
import type { Decimal } from "@prisma/client/runtime/client";

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_ROLES: Role[] = ["ADMIN"];
const MANAGER_ROLES: Role[] = ["ADMIN", "MANAGER"];

function hasRole(userRole: Role, allowed: Role[]): boolean {
  return allowed.includes(userRole);
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

// ─── Chart of Accounts ────────────────────────────────────────────────────────

export type AccountWithParent = Account & {
  parent: { id: string; code: string; name: string } | null;
  _count: { children: number; journalLines: number };
};

export async function getAccounts(
  params?: { type?: string; active?: boolean }
): Promise<ActionResponse<Account[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, ADMIN_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const where: Record<string, unknown> = {};

    if (params?.type) {
      where.type = params.type;
    }
    if (params?.active !== undefined) {
      where.active = params.active;
    }

    const accounts = await db.account.findMany({
      where,
      orderBy: { code: "asc" },
    });

    return { success: true, data: accounts };
  } catch (error) {
    console.error("getAccounts error:", error);
    return { success: false, error: "Failed to fetch accounts" };
  }
}

export async function getAccount(
  id: string
): Promise<ActionResponse<Account & { balances: AccountBalance[] }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const account = await db.account.findUnique({
      where: { id },
      include: {
        balances: {
          orderBy: [{ year: "desc" }, { month: "desc" }],
          take: 12,
        },
      },
    });

    if (!account) return { success: false, error: "Account not found" };

    return { success: true, data: account };
  } catch (error) {
    console.error("getAccount error:", error);
    return { success: false, error: "Failed to fetch account" };
  }
}

export async function createAccount(data: {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  normalBalance: "DEBIT" | "CREDIT";
  parentId?: string;
  description?: string;
}): Promise<ActionResponse<Account>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, ADMIN_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    if (!data.code || data.code.trim().length === 0) {
      return { success: false, error: "Account code is required" };
    }

    if (!data.name || data.name.trim().length === 0) {
      return { success: false, error: "Account name is required" };
    }

    const existing = await db.account.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      return { success: false, error: "Account code already exists: " + data.code };
    }

    if (data.parentId) {
      const parent = await db.account.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) {
        return { success: false, error: "Parent account not found: " + data.parentId };
      }
    }

    const account = await db.account.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        normalBalance: data.normalBalance,
        parentId: data.parentId ?? null,
        description: data.description ?? null,
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "Account",
        entityId: account.id,
        newValues: {
          code: account.code,
          name: account.name,
          type: account.type,
          normalBalance: account.normalBalance,
        },
      },
    });

    return { success: true, data: account };
  } catch (error) {
    console.error("createAccount error:", error);
    return { success: false, error: "Failed to create account" };
  }
}

export async function updateAccount(
  id: string,
  data: {
    name?: string;
    description?: string;
    active?: boolean;
  }
): Promise<ActionResponse<Account>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, ADMIN_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const existing = await db.account.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Account not found" };

    const account = await db.account.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        description: data.description !== undefined ? data.description : existing.description,
        active: data.active !== undefined ? data.active : existing.active,
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Account",
        entityId: id,
        oldValues: {
          name: existing.name,
          description: existing.description,
          active: existing.active,
        },
        newValues: {
          name: account.name,
          description: account.description,
          active: account.active,
        },
      },
    });

    return { success: true, data: account };
  } catch (error) {
    console.error("updateAccount error:", error);
    return { success: false, error: "Failed to update account" };
  }
}

export async function getActiveAccounts(): Promise<ActionResponse<Account[]>> {
  return getAccounts({ active: true });
}

// ─── Journal Entries & General Ledger ─────────────────────────────────────────

export type JournalEntryWithRelations = JournalEntry & {
  lines: (JournalLine & {
    account: { id: string; code: string; name: string; type: AccountType };
  })[];
  createdBy: { id: string; name: string; role: Role };
};

export async function getJournalEntries(
  params?: {
    startDate?: string;
    endDate?: string;
    accountId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<ActionResponse<PaginatedResponse<JournalEntryWithRelations>>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, ADMIN_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (params?.startDate || params?.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (params.startDate) {
        dateFilter.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        const toEnd = new Date(params.endDate);
        toEnd.setHours(23, 59, 59, 999);
        dateFilter.lte = toEnd;
      }
      where.date = dateFilter;
    }

    if (params?.accountId) {
      where.lines = {
        some: { accountId: params.accountId },
      };
    }

    if (params?.search) {
      where.OR = [
        { description: { contains: params.search, mode: "insensitive" } },
        { entryNumber: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                },
              },
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
        orderBy: { date: "desc" },
        skip,
        take: pageSize,
      }),
      db.journalEntry.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: items as JournalEntryWithRelations[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("getJournalEntries error:", error);
    return { success: false, error: "Failed to fetch journal entries" };
  }
}

export async function getJournalEntry(
  id: string
): Promise<ActionResponse<JournalEntryWithRelations>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const entry = await db.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
              },
            },
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
    });

    if (!entry) return { success: false, error: "Journal entry not found" };

    return { success: true, data: entry as JournalEntryWithRelations };
  } catch (error) {
    console.error("getJournalEntry error:", error);
    return { success: false, error: "Failed to fetch journal entry" };
  }
}

export async function reverseJournalEntryAction(
  entryId: string,
  reason: string
): Promise<ActionResponse<JournalEntry>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, ADMIN_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "Reversal reason is required" };
    }

    const reversed = await reverseJournalEntry(entryId, reason, session.user.id);

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "REVERSE",
        entity: "JournalEntry",
        entityId: entryId,
        newValues: {
          reversedEntryId: reversed.id,
          reason,
        },
      },
    });

    return { success: true, data: reversed };
  } catch (error) {
    console.error("reverseJournalEntryAction error:", error);
    return { success: false, error: "Failed to reverse journal entry. Please try again." };
  }
}

// ─── Account Balances / Trial Balance ─────────────────────────────────────────

export type TrialBalanceEntry = {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: string;
  debitTotal: number;
  creditTotal: number;
};

type TrialBalanceResult = {
  accounts: TrialBalanceEntry[];
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
  year: number;
  month: number;
};

export async function getTrialBalance(
  params?: { year?: number; month?: number }
): Promise<ActionResponse<TrialBalanceResult>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, ADMIN_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const now = new Date();
    const year = params?.year ?? now.getFullYear();
    const month = params?.month ?? now.getMonth() + 1;

    const balances = await db.accountBalance.findMany({
      where: { year, month },
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            normalBalance: true,
          },
        },
      },
      orderBy: { account: { code: "asc" } },
    });

    const accounts: TrialBalanceEntry[] = balances.map((b) => ({
      accountId: b.accountId,
      code: b.account.code,
      name: b.account.name,
      type: b.account.type,
      normalBalance: b.account.normalBalance,
      debitTotal: Number(b.debitTotal),
      creditTotal: Number(b.creditTotal),
    }));

    const totalDebits = accounts.reduce((sum, a) => sum + a.debitTotal, 0);
    const totalCredits = accounts.reduce((sum, a) => sum + a.creditTotal, 0);

    const roundedDebits = Math.round(totalDebits * 100) / 100;
    const roundedCredits = Math.round(totalCredits * 100) / 100;

    return {
      success: true,
      data: {
        accounts,
        totalDebits: roundedDebits,
        totalCredits: roundedCredits,
        balanced: roundedDebits === roundedCredits,
        year,
        month,
      },
    };
  } catch (error) {
    console.error("getTrialBalance error:", error);
    return { success: false, error: "Failed to fetch trial balance" };
  }
}

type AccountBalanceWithAccount = AccountBalance & {
  account: {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    normalBalance: string;
  };
};

export async function getAccountBalances(
  params?: { year?: number; month?: number; type?: string }
): Promise<ActionResponse<AccountBalanceWithAccount[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, ADMIN_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const now = new Date();
    const year = params?.year ?? now.getFullYear();
    const month = params?.month ?? now.getMonth() + 1;

    const where: Record<string, unknown> = { year, month };

    if (params?.type) {
      where.account = { type: params.type };
    }

    const balances = await db.accountBalance.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            normalBalance: true,
          },
        },
      },
      orderBy: { account: { code: "asc" } },
    });

    return { success: true, data: balances as AccountBalanceWithAccount[] };
  } catch (error) {
    console.error("getAccountBalances error:", error);
    return { success: false, error: "Failed to fetch account balances" };
  }
}

// ─── General Ledger Report ────────────────────────────────────────────────────

export type GeneralLedgerLine = {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string | null;
  journalEntry: {
    entryNumber: string;
    date: Date;
    description: string;
  };
  runningBalance: number;
};

export async function getGeneralLedger(
  params: { accountId: string; startDate: string; endDate: string }
): Promise<ActionResponse<GeneralLedgerLine[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, ADMIN_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const account = await db.account.findUnique({
      where: { id: params.accountId },
    });
    if (!account) return { success: false, error: "Account not found" };

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    endDate.setHours(23, 59, 59, 999);

    const lines = await db.journalLine.findMany({
      where: {
        accountId: params.accountId,
        journalEntry: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        journalEntry: {
          select: {
            entryNumber: true,
            date: true,
            description: true,
          },
        },
      },
      orderBy: { journalEntry: { date: "asc" } },
    });

    const isDebitNormal = account.normalBalance === "DEBIT";
    let runningBalance = 0;

    const result: GeneralLedgerLine[] = lines.map((line) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);

      if (isDebitNormal) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }

      return {
        id: line.id,
        journalEntryId: line.journalEntryId,
        accountId: line.accountId,
        debit,
        credit,
        description: line.description,
        journalEntry: line.journalEntry,
        runningBalance: Math.round(runningBalance * 100) / 100,
      };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("getGeneralLedger error:", error);
    return { success: false, error: "Failed to fetch general ledger" };
  }
}

// ─── Accounts Receivable ──────────────────────────────────────────────────────

type CustomerWithReceivables = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  dueBalance: Decimal;
  receivables: AccountsReceivable[];
};

export async function getAccountsReceivable(): Promise<
  ActionResponse<{ customers: CustomerWithReceivables[]; totalDue: number }>
> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, MANAGER_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const customers = await db.customer.findMany({
      where: {
        dueBalance: { gt: 0 },
      },
      include: {
        receivables: {
          where: { status: "OUTSTANDING" },
        },
      },
      orderBy: { name: "asc" },
    });

    const totalDue = customers.reduce(
      (sum, c) => sum + Number(c.dueBalance),
      0
    );

    return {
      success: true,
      data: {
        customers: customers as unknown as CustomerWithReceivables[],
        totalDue: Math.round(totalDue * 100) / 100,
      },
    };
  } catch (error) {
    console.error("getAccountsReceivable error:", error);
    return { success: false, error: "Failed to fetch accounts receivable" };
  }
}

export async function processCustomerPayment(
  customerId: string,
  data: { amount: number; orderId?: string; reference?: string }
): Promise<ActionResponse<{ paid: number; remaining: number }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, MANAGER_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const customer = await db.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) return { success: false, error: "Customer not found" };

    if (data.amount <= 0) {
      return { success: false, error: "Payment amount must be positive" };
    }

    if (data.amount > Number(customer.dueBalance)) {
      return {
        success: false,
        error:
          "Payment amount (" +
          data.amount +
          ") exceeds customer due balance (" +
          customer.dueBalance +
          ")",
      };
    }

    // Duplicate payment protection — 2-minute window
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentDuplicate = await db.payment.findFirst({
      where: {
        amount: data.amount,
        createdAt: { gte: twoMinutesAgo },
        order: { customerId },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recentDuplicate) {
      return { success: false, error: "Duplicate payment detected. Please wait before submitting again." };
    }

    const accountCodes = ["1000", "1100"];
    const accountMap = await getAccountIdsByCode(accountCodes);

    const result = await db.$transaction(async (tx: TransactionClient) => {
      if (data.orderId) {
        const order = await tx.order.findUnique({
          where: { id: data.orderId },
        });
        if (!order) throw new Error("Order not found: " + data.orderId);
        if (order.customerId !== customerId) {
          throw new Error("Order does not belong to this customer");
        }

        const totalPaid = await tx.payment.aggregate({
          where: { orderId: data.orderId },
          _sum: { amount: true },
        });
        const alreadyPaid = Number(totalPaid._sum.amount ?? 0);
        const remaining = Number(order.grandTotal) - alreadyPaid;
        const applied = Math.min(data.amount, remaining);

        await tx.payment.create({
          data: {
            orderId: data.orderId,
            method: "CASH",
            amount: applied,
            reference: data.reference ?? null,
            receivedById: session.user.id,
          },
        });

        const newTotalPaid = alreadyPaid + applied;
        let paymentStatus: string;
        if (newTotalPaid >= Number(order.grandTotal)) {
          paymentStatus = "PAID";
        } else {
          paymentStatus = "PARTIAL";
        }

        await tx.order.update({
          where: { id: data.orderId },
          data: { paymentStatus: paymentStatus as "PAID" | "PARTIAL" },
        });
      } else {
        const unpaidOrders = await tx.order.findMany({
          where: {
            customerId,
            paymentStatus: { in: ["UNPAID", "PARTIAL"] },
            status: { notIn: ["CANCELLED"] },
          },
          orderBy: { createdAt: "asc" },
        });

        let remainingPayment = data.amount;

        for (const order of unpaidOrders) {
          if (remainingPayment <= 0) break;

          const totalPaid = await tx.payment.aggregate({
            where: { orderId: order.id },
            _sum: { amount: true },
          });
          const alreadyPaid = Number(totalPaid._sum.amount ?? 0);
          const orderDue = Number(order.grandTotal) - alreadyPaid;
          const applied = Math.min(remainingPayment, orderDue);

          if (applied > 0) {
            await tx.payment.create({
              data: {
                orderId: order.id,
                method: "CASH",
                amount: applied,
                reference: data.reference ?? null,
                receivedById: session.user.id,
              },
            });

            const newTotalPaid = alreadyPaid + applied;
            let paymentStatus: string;
            if (newTotalPaid >= Number(order.grandTotal)) {
              paymentStatus = "PAID";
            } else {
              paymentStatus = "PARTIAL";
            }

            await tx.order.update({
              where: { id: order.id },
              data: { paymentStatus: paymentStatus as "PAID" | "PARTIAL" },
            });
          }

          remainingPayment -= applied;
        }
      }

      await tx.customer.update({
        where: { id: customerId },
        data: {
          dueBalance: {
            decrement: data.amount,
          },
        },
      });

      try {
        const cashAccountId = accountMap.get("1000");
        const arAccountId = accountMap.get("1100");

        if (cashAccountId && arAccountId) {
          let lines = customerPayment(data.amount, cashAccountId);
          lines = lines.map((l) => {
            const resolvedId = accountMap.get(l.accountId);
            if (!resolvedId) {
              throw new Error("Account not found for code: " + l.accountId);
            }
            return { ...l, accountId: resolvedId };
          });

          await createJournalEntry({
            description:
              "Customer payment from " +
              customer.name +
              (data.reference ? " (Ref: " + data.reference + ")" : ""),
            referenceType: "CUSTOMER_PAYMENT",
            referenceId: customerId + "_" + Date.now(),
            userId: session.user.id,
            lines,
          });
        }
      } catch (journalError) {
        console.error(
          "Failed to create journal entry for customer payment:",
          journalError
        );
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "CustomerPayment",
          entityId: customerId,
          newValues: {
            customerId,
            amount: data.amount,
            orderId: data.orderId ?? null,
            reference: data.reference ?? null,
          },
        },
      });

      const finalCustomer = await tx.customer.findUnique({
        where: { id: customerId },
      });

      return {
        paid: data.amount,
        remaining: Number(finalCustomer?.dueBalance ?? 0),
      };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("processCustomerPayment error:", error);
    return { success: false, error: "Failed to process customer payment. Please try again." };
  }
}

// ─── Accounts Payable ─────────────────────────────────────────────────────────

type SupplierWithPayables = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  dueBalance: Decimal;
  payables: AccountsPayable[];
};

export async function getAccountsPayable(): Promise<
  ActionResponse<{ suppliers: SupplierWithPayables[]; totalDue: number }>
> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, MANAGER_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const suppliers = await db.supplier.findMany({
      where: {
        dueBalance: { gt: 0 },
      },
      include: {
        payables: {
          where: { status: "OUTSTANDING" },
        },
      },
      orderBy: { name: "asc" },
    });

    const totalDue = suppliers.reduce(
      (sum, s) => sum + Number(s.dueBalance),
      0
    );

    return {
      success: true,
      data: {
        suppliers: suppliers as unknown as SupplierWithPayables[],
        totalDue: Math.round(totalDue * 100) / 100,
      },
    };
  } catch (error) {
    console.error("getAccountsPayable error:", error);
    return { success: false, error: "Failed to fetch accounts payable" };
  }
}

// ─── Refunds ──────────────────────────────────────────────────────────────────

type RefundWithRelations = Refund & {
  order: {
    id: string;
    orderNumber: string;
    grandTotal: Decimal;
    subtotal: Decimal;
    taxAmount: Decimal;
    paymentStatus: string;
  };
  processedBy: { id: string; name: string; role: Role };
};

export async function createRefund(
  orderId: string,
  data: { amount: number; reason: string }
): Promise<ActionResponse<Refund>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, MANAGER_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    if (data.amount <= 0) {
      return { success: false, error: "Refund amount must be positive" };
    }

    if (!data.reason || data.reason.trim().length === 0) {
      return { success: false, error: "Refund reason is required" };
    }

    const accountCodes = ["1000", "4000", "2100"];
    const accountMap = await getAccountIdsByCode(accountCodes);

    const refund = await db.$transaction(async (tx: TransactionClient) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });

      if (!order) throw new Error("Order not found: " + orderId);

      const totalPaid = order.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      if (data.amount > totalPaid) {
        throw new Error(
          "Refund amount (" + data.amount + ") exceeds total paid (" + totalPaid + ")"
        );
      }

      const existingRefunds = await tx.refund.findMany({
        where: { orderId },
      });
      const totalRefunded = existingRefunds.reduce(
        (sum, r) => sum + Number(r.amount),
        0
      );

      if (totalRefunded + data.amount > totalPaid) {
        throw new Error(
          "Total refunded amount would exceed total paid. Already refunded: " +
            totalRefunded +
            ", requested: " +
            data.amount +
            ", total paid: " +
            totalPaid
        );
      }

      const createdRefund = await tx.refund.create({
        data: {
          orderId,
          amount: data.amount,
          reason: data.reason,
          processedById: session.user.id,
        },
      });

      const newTotalRefunded = totalRefunded + data.amount;

      let paymentStatus: string;
      if (newTotalRefunded >= totalPaid) {
        paymentStatus = "REFUNDED";
      } else {
        paymentStatus = "PARTIALLY_REFUNDED";
      }

      const orderUpdateData: Record<string, unknown> = {
        paymentStatus,
      };

      if (paymentStatus === "REFUNDED") {
        orderUpdateData.status = "CANCELLED";
      }

      await tx.order.update({
        where: { id: orderId },
        data: orderUpdateData,
      });

      try {
        const salesAccountId = accountMap.get("4000");
        const cashAccountId = accountMap.get("1000");

        if (salesAccountId && cashAccountId) {
          const isFullRefund = newTotalRefunded >= totalPaid;
          const orderSubtotal = Number(order.subtotal);
          const orderTaxAmount = Number(order.taxAmount);

          let lines: JournalLineInput[];

          if (isFullRefund) {
            lines = fullRefund(orderSubtotal, orderTaxAmount, cashAccountId);
          } else {
            const proportionalTax = totalPaid > 0
              ? (orderTaxAmount / orderSubtotal) * data.amount
              : 0;
            lines = partialRefund(data.amount, cashAccountId, proportionalTax);
          }

          lines = lines.map((l) => {
            const resolvedId = accountMap.get(l.accountId);
            if (!resolvedId) {
              throw new Error("Account not found for code: " + l.accountId);
            }
            return { ...l, accountId: resolvedId };
          });

          await createJournalEntry({
            description: "Refund for order " + order.orderNumber + ": " + data.reason,
            referenceType: "REFUND",
            referenceId: createdRefund.id,
            userId: session.user.id,
            lines,
          });
        }
      } catch (journalError) {
        console.error(
          "Failed to create journal entry for refund:",
          journalError
        );
      }

      if (order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            dueBalance: {
              decrement: data.amount,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "Refund",
          entityId: createdRefund.id,
          newValues: {
            orderId,
            amount: data.amount,
            reason: data.reason,
            paymentStatus,
          },
        },
      });

      return createdRefund;
    });

    return { success: true, data: refund };
  } catch (error) {
    console.error("createRefund error:", error);
    return { success: false, error: "Failed to create refund. Please try again." };
  }
}

export async function getRefunds(
  params?: { page?: number; pageSize?: number }
): Promise<ActionResponse<PaginatedResponse<RefundWithRelations>>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, ADMIN_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      db.refund.findMany({
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              grandTotal: true,
              subtotal: true,
              taxAmount: true,
              paymentStatus: true,
            },
          },
          processedBy: {
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
      db.refund.count(),
    ]);

    return {
      success: true,
      data: {
        items: items as RefundWithRelations[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("getRefunds error:", error);
    return { success: false, error: "Failed to fetch refunds" };
  }
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

type ExpenseWithRelations = Expense & {
  createdBy: { id: string; name: string; role: Role };
};

export async function createExpense(data: {
  description: string;
  amount: number;
  accountId: string;
  date?: string;
  receipt?: string;
}): Promise<ActionResponse<Expense>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, MANAGER_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    if (data.amount <= 0) {
      return { success: false, error: "Amount must be positive" };
    }

    if (!data.description || data.description.trim().length === 0) {
      return { success: false, error: "Description is required" };
    }

    const account = await db.account.findUnique({
      where: { id: data.accountId },
    });
    if (!account) {
      return { success: false, error: "Account not found: " + data.accountId };
    }

    const accountCodes = ["1000"];
    const accountMap = await getAccountIdsByCode(accountCodes);

    const expense = await db.$transaction(async (tx: TransactionClient) => {
      const createdExpense = await tx.expense.create({
        data: {
          description: data.description,
          amount: data.amount,
          accountId: data.accountId,
          date: data.date ? new Date(data.date) : new Date(),
          receipt: data.receipt ?? null,
          createdById: session.user.id,
        },
      });

      try {
        const cashAccountId = accountMap.get("1000");

        if (cashAccountId) {
          let lines = expenseTemplate(
            data.amount,
            cashAccountId,
            data.accountId
          );
          lines = lines.map((l) => {
            const resolvedId = accountMap.get(l.accountId);
            if (!resolvedId) {
              throw new Error("Account not found for code: " + l.accountId);
            }
            return { ...l, accountId: resolvedId };
          });

          await createJournalEntry({
            description: "Expense: " + data.description,
            referenceType: "EXPENSE",
            referenceId: createdExpense.id,
            userId: session.user.id,
            lines,
          });
        }
      } catch (journalError) {
        console.error(
          "Failed to create journal entry for expense:",
          journalError
        );
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "Expense",
          entityId: createdExpense.id,
          newValues: {
            description: data.description,
            amount: data.amount,
            accountId: data.accountId,
          },
        },
      });

      return createdExpense;
    });

    return { success: true, data: expense };
  } catch (error) {
    console.error("createExpense error:", error);
    return { success: false, error: "Failed to create expense. Please try again." };
  }
}

export async function getExpenses(
  params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<ActionResponse<PaginatedResponse<ExpenseWithRelations>>> {
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

    if (params?.startDate || params?.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (params.startDate) {
        dateFilter.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        const toEnd = new Date(params.endDate);
        toEnd.setHours(23, 59, 59, 999);
        dateFilter.lte = toEnd;
      }
      where.date = dateFilter;
    }

    const [items, total] = await Promise.all([
      db.expense.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: { date: "desc" },
        skip,
        take: pageSize,
      }),
      db.expense.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: items as ExpenseWithRelations[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("getExpenses error:", error);
    return { success: false, error: "Failed to fetch expenses" };
  }
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

type AuditLogWithUser = {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user: { id: string; name: string; role: Role } | null;
};

export async function getAuditLogs(
  params?: {
    entity?: string;
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<ActionResponse<PaginatedResponse<AuditLogWithUser>>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!hasRole(session.user.role, ADMIN_ROLES)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (params?.entity) {
      where.entity = params.entity;
    }
    if (params?.action) {
      where.action = params.action;
    }
    if (params?.userId) {
      where.userId = params.userId;
    }
    if (params?.startDate || params?.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (params.startDate) {
        dateFilter.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        const toEnd = new Date(params.endDate);
        toEnd.setHours(23, 59, 59, 999);
        dateFilter.lte = toEnd;
      }
      where.createdAt = dateFilter;
    }

    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: {
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
      db.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: items as AuditLogWithUser[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("getAuditLogs error:", error);
    return { success: false, error: "Failed to fetch audit logs" };
  }
}
