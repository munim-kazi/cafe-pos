"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { ActionResponse } from "@/types";

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export type DashboardStats = {
  todayRevenue: number;
  todayOrders: number;
  monthlyRevenue: number;
  monthlyOrders: number;
  pendingOrders: number;
  lowStockAlerts: number;
};

export async function getDashboardStats(): Promise<
  ActionResponse<DashboardStats>
> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };

    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const [
      todayOrders,
      monthlyOrders,
      pendingOrders,
      lowStockAlerts,
      todayPayments,
      monthlyPayments,
    ] = await Promise.all([
      db.order.count({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: { not: "CANCELLED" },
        },
      }),
      db.order.count({
        where: {
          createdAt: { gte: startOfMonth, lte: endOfMonth },
          status: { not: "CANCELLED" },
        },
      }),
      db.order.count({
        where: {
          status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
        },
      }),
      db.ingredient.count({
        where: {
          active: true,
          currentStock: { lte: db.ingredient.fields.lowStockThreshold },
        },
      }),
      db.payment.aggregate({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          order: { status: { not: "CANCELLED" } },
        },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: {
          createdAt: { gte: startOfMonth, lte: endOfMonth },
          order: { status: { not: "CANCELLED" } },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      success: true,
      data: {
        todayRevenue: Number(todayPayments._sum.amount ?? 0),
        todayOrders,
        monthlyRevenue: Number(monthlyPayments._sum.amount ?? 0),
        monthlyOrders,
        pendingOrders,
        lowStockAlerts,
      },
    };
  } catch (error) {
    console.error("getDashboardStats error:", error);
    return { success: false, error: "Failed to fetch dashboard stats" };
  }
}

// ─── Sales Report ────────────────────────────────────────────────────────────

export type DailySales = {
  date: string;
  orders: number;
  revenue: number;
  tax: number;
  discounts: number;
  avgOrder: number;
};

export type PaymentMethodBreakdown = {
  method: string;
  count: number;
  total: number;
};

export type OrderTypeBreakdown = {
  type: string;
  count: number;
  total: number;
};

export type SalesReportData = {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  totalTax: number;
  daily: DailySales[];
  byPaymentMethod: PaymentMethodBreakdown[];
  byOrderType: OrderTypeBreakdown[];
};

export async function getSalesReport(params: {
  startDate: string;
  endDate: string;
}): Promise<ActionResponse<SalesReportData>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);

    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
      include: {
        payments: true,
      },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (sum, o) => sum + Number(o.grandTotal),
      0
    );
    const totalTax = orders.reduce(
      (sum, o) => sum + Number(o.taxAmount),
      0
    );
    const avgOrderValue =
      totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;

    // Daily breakdown
    const dailyMap = new Map<
      string,
      {
        orders: number;
        revenue: number;
        tax: number;
        discounts: number;
      }
    >();

    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().slice(0, 10);
      const existing = dailyMap.get(dateKey) ?? {
        orders: 0,
        revenue: 0,
        tax: 0,
        discounts: 0,
      };
      existing.orders += 1;
      existing.revenue += Number(order.grandTotal);
      existing.tax += Number(order.taxAmount);
      existing.discounts += Number(order.discountAmount);
      dailyMap.set(dateKey, existing);
    }

    const daily: DailySales[] = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        ...data,
        avgOrder:
          data.orders > 0
            ? Math.round((data.revenue / data.orders) * 100) / 100
            : 0,
      }));

    // By payment method
    const paymentMap = new Map<string, { count: number; total: number }>();
    for (const order of orders) {
      for (const payment of order.payments) {
        const method = payment.method;
        const existing = paymentMap.get(method) ?? { count: 0, total: 0 };
        existing.count += 1;
        existing.total += Number(payment.amount);
        paymentMap.set(method, existing);
      }
    }

    const byPaymentMethod: PaymentMethodBreakdown[] = Array.from(
      paymentMap.entries()
    ).map(([method, data]) => ({ method, ...data }));

    // By order type
    const typeMap = new Map<string, { count: number; total: number }>();
    for (const order of orders) {
      const type = order.type;
      const existing = typeMap.get(type) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += Number(order.grandTotal);
      typeMap.set(type, existing);
    }

    const byOrderType: OrderTypeBreakdown[] = Array.from(typeMap.entries()).map(
      ([type, data]) => ({ type, ...data })
    );

    return {
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        avgOrderValue,
        totalTax,
        daily,
        byPaymentMethod,
        byOrderType,
      },
    };
  } catch (error) {
    console.error("getSalesReport error:", error);
    return { success: false, error: "Failed to fetch sales report" };
  }
}

// ─── Best Selling Products ───────────────────────────────────────────────────

export type BestSellingProduct = {
  rank: number;
  name: string;
  category: string;
  quantitySold: number;
  revenue: number;
  avgPrice: number;
};

export async function getBestSellingProducts(params: {
  startDate: string;
  endDate: string;
  limit?: number;
}): Promise<ActionResponse<BestSellingProduct[]>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);

    const orderItems = await db.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          status: { not: "CANCELLED" },
        },
      },
      include: {
        menuItem: {
          include: { category: true },
        },
      },
    });

    const productMap = new Map<
      string,
      {
        name: string;
        category: string;
        quantitySold: number;
        revenue: number;
      }
    >();

    for (const item of orderItems) {
      const key = item.menuItemId;
      const existing = productMap.get(key) ?? {
        name: item.name,
        category: item.menuItem.category.name,
        quantitySold: 0,
        revenue: 0,
      };
      existing.quantitySold += item.quantity;
      existing.revenue += Number(item.subtotal);
      productMap.set(key, existing);
    }

    const sorted = Array.from(productMap.entries())
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, params.limit ?? 10);

    const result: BestSellingProduct[] = sorted.map(([, data], index) => ({
      rank: index + 1,
      ...data,
      avgPrice:
        data.quantitySold > 0
          ? Math.round((data.revenue / data.quantitySold) * 100) / 100
          : 0,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error("getBestSellingProducts error:", error);
    return { success: false, error: "Failed to fetch best selling products" };
  }
}

// ─── Purchase Report ─────────────────────────────────────────────────────────

export type DailyPurchase = {
  date: string;
  purchases: number;
  total: number;
  credit: number;
  cash: number;
};

export type SupplierBreakdown = {
  supplierName: string;
  count: number;
  total: number;
};

export type PurchaseReportData = {
  totalPurchases: number;
  totalAmount: number;
  creditTotal: number;
  cashTotal: number;
  daily: DailyPurchase[];
  bySupplier: SupplierBreakdown[];
};

export async function getPurchaseReport(params: {
  startDate: string;
  endDate: string;
}): Promise<ActionResponse<PurchaseReportData>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);

    const purchases = await db.purchase.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
      include: {
        supplier: { select: { name: true } },
      },
    });

    const totalPurchases = purchases.length;
    const totalAmount = purchases.reduce(
      (sum, p) => sum + Number(p.total),
      0
    );
    const creditTotal = purchases
      .filter((p) => p.isCredit)
      .reduce((sum, p) => sum + Number(p.total), 0);
    const cashTotal = totalAmount - creditTotal;

    // Daily breakdown
    const dailyMap = new Map<
      string,
      { purchases: number; total: number; credit: number; cash: number }
    >();

    for (const purchase of purchases) {
      const dateKey = purchase.createdAt.toISOString().slice(0, 10);
      const existing = dailyMap.get(dateKey) ?? {
        purchases: 0,
        total: 0,
        credit: 0,
        cash: 0,
      };
      existing.purchases += 1;
      existing.total += Number(purchase.total);
      if (purchase.isCredit) {
        existing.credit += Number(purchase.total);
      } else {
        existing.cash += Number(purchase.total);
      }
      dailyMap.set(dateKey, existing);
    }

    const daily: DailyPurchase[] = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    // By supplier
    const supplierMap = new Map<string, { count: number; total: number }>();
    for (const purchase of purchases) {
      const name = purchase.supplier.name;
      const existing = supplierMap.get(name) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += Number(purchase.total);
      supplierMap.set(name, existing);
    }

    const bySupplier: SupplierBreakdown[] = Array.from(
      supplierMap.entries()
    ).map(([supplierName, data]) => ({ supplierName, ...data }));

    return {
      success: true,
      data: {
        totalPurchases,
        totalAmount,
        creditTotal,
        cashTotal,
        daily,
        bySupplier,
      },
    };
  } catch (error) {
    console.error("getPurchaseReport error:", error);
    return { success: false, error: "Failed to fetch purchase report" };
  }
}

// ─── Expense Report ──────────────────────────────────────────────────────────

export type DailyExpense = {
  date: string;
  count: number;
  total: number;
};

export type ExpenseByAccount = {
  accountName: string;
  count: number;
  total: number;
};

export type ExpenseReportData = {
  totalExpenses: number;
  totalAmount: number;
  daily: DailyExpense[];
  byAccount: ExpenseByAccount[];
};

export async function getExpenseReport(params: {
  startDate: string;
  endDate: string;
}): Promise<ActionResponse<ExpenseReportData>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);

    const expenses = await db.expense.findMany({
      where: {
        date: { gte: start, lte: end },
      },
    });

    const expenseAccountIds = [...new Set(expenses.map((e) => e.accountId))];
    const accounts = await db.account.findMany({
      where: { id: { in: expenseAccountIds } },
      select: { id: true, name: true },
    });
    const accountLookup = new Map(accounts.map((a) => [a.id, a.name]));

    const totalExpenses = expenses.length;
    const totalAmount = expenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0
    );

    // Daily breakdown
    const dailyMap = new Map<string, { count: number; total: number }>();
    for (const expense of expenses) {
      const dateKey = expense.date.toISOString().slice(0, 10);
      const existing = dailyMap.get(dateKey) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += Number(expense.amount);
      dailyMap.set(dateKey, existing);
    }

    const daily: DailyExpense[] = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    // By account
    const accountMap = new Map<string, { count: number; total: number }>();
    for (const expense of expenses) {
      const name = accountLookup.get(expense.accountId) ?? "Unknown";
      const existing = accountMap.get(name) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += Number(expense.amount);
      accountMap.set(name, existing);
    }

    const byAccount: ExpenseByAccount[] = Array.from(accountMap.entries()).map(
      ([accountName, data]) => ({ accountName, ...data })
    );

    return {
      success: true,
      data: {
        totalExpenses,
        totalAmount,
        daily,
        byAccount,
      },
    };
  } catch (error) {
    console.error("getExpenseReport error:", error);
    return { success: false, error: "Failed to fetch expense report" };
  }
}

// ─── Profit & Loss Report ────────────────────────────────────────────────────

export type PLineItem = {
  label: string;
  amount: number;
};

export type ProfitLossData = {
  revenue: { items: PLineItem[]; total: number };
  cogs: { items: PLineItem[]; total: number };
  grossProfit: number;
  expenses: { items: PLineItem[]; total: number };
  netIncome: number;
};

export async function getProfitLossReport(params: {
  startDate: string;
  endDate: string;
}): Promise<ActionResponse<ProfitLossData>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };

    if (session.user.role !== "ADMIN") {
      return { success: false, error: "Insufficient permissions" };
    }

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);

    // Revenue from journal lines on revenue accounts
    const revenueAccounts = await db.account.findMany({
      where: { type: "REVENUE" },
      select: { id: true, name: true },
    });

    const expenseAccounts = await db.account.findMany({
      where: { type: "EXPENSE" },
      select: { id: true, name: true },
    });

    const revenueItems: PLineItem[] = [];
    let totalRevenue = 0;

    for (const account of revenueAccounts) {
      const lines = await db.journalLine.findMany({
        where: {
          accountId: account.id,
          journalEntry: {
            date: { gte: start, lte: end },
            isReversal: false,
          },
        },
      });
      const net = lines.reduce(
        (sum, l) => sum + Number(l.credit) - Number(l.debit),
        0
      );
      if (net !== 0) {
        revenueItems.push({ label: account.name, amount: net });
        totalRevenue += net;
      }
    }

    const expenseItems: PLineItem[] = [];

    for (const account of expenseAccounts) {
      const lines = await db.journalLine.findMany({
        where: {
          accountId: account.id,
          journalEntry: {
            date: { gte: start, lte: end },
            isReversal: false,
          },
        },
      });
      const net = lines.reduce(
        (sum, l) => sum + Number(l.debit) - Number(l.credit),
        0
      );
      if (net !== 0) {
        expenseItems.push({ label: account.name, amount: net });
      }
    }

    // COGS - try to get from Cost of Goods Sold accounts (typically 5xxx)
    const cogsAccounts = await db.account.findMany({
      where: {
        type: "EXPENSE",
        code: { startsWith: "5" },
      },
      select: { id: true, name: true },
    });

    const cogsItems: PLineItem[] = [];
    let totalCogs = 0;

    for (const account of cogsAccounts) {
      const lines = await db.journalLine.findMany({
        where: {
          accountId: account.id,
          journalEntry: {
            date: { gte: start, lte: end },
            isReversal: false,
          },
        },
      });
      const net = lines.reduce(
        (sum, l) => sum + Number(l.debit) - Number(l.credit),
        0
      );
      if (net !== 0) {
        cogsItems.push({ label: account.name, amount: net });
        totalCogs += net;
      }
    }

    // Operating expenses = total expenses minus COGS
    const operatingExpenseItems = expenseItems.filter(
      (e) => !cogsItems.some((c) => c.label === e.label)
    );
    const totalOperatingExpenses = operatingExpenseItems.reduce(
      (sum, e) => sum + e.amount,
      0
    );

    const grossProfit = totalRevenue - totalCogs;
    const netIncome = totalRevenue - totalCogs - totalOperatingExpenses;

    return {
      success: true,
      data: {
        revenue: { items: revenueItems, total: totalRevenue },
        cogs: { items: cogsItems, total: totalCogs },
        grossProfit,
        expenses: {
          items: operatingExpenseItems,
          total: totalOperatingExpenses,
        },
        netIncome,
      },
    };
  } catch (error) {
    console.error("getProfitLossReport error:", error);
    return { success: false, error: "Failed to fetch profit & loss report" };
  }
}

// ─── Balance Sheet ───────────────────────────────────────────────────────────

export type BSLineItem = {
  label: string;
  code: string;
  amount: number;
};

export type BalanceSheetData = {
  asOfDate: string;
  assets: { items: BSLineItem[]; total: number };
  liabilities: { items: BSLineItem[]; total: number };
  equity: { items: BSLineItem[]; total: number };
  balanced: boolean;
};

export async function getBalanceSheet(params: {
  asOfDate: string;
}): Promise<ActionResponse<BalanceSheetData>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };

    if (session.user.role !== "ADMIN") {
      return { success: false, error: "Insufficient permissions" };
    }

    const asOf = new Date(params.asOfDate);
    asOf.setHours(23, 59, 59, 999);

    const assetAccounts = await db.account.findMany({
      where: { type: "ASSET" },
      select: { id: true, code: true, name: true, normalBalance: true },
    });

    const liabilityAccounts = await db.account.findMany({
      where: { type: "LIABILITY" },
      select: { id: true, code: true, name: true, normalBalance: true },
    });

    const equityAccounts = await db.account.findMany({
      where: { type: "EQUITY" },
      select: { id: true, code: true, name: true, normalBalance: true },
    });

    async function getAccountBalance(
      accountId: string,
      normalBalance: string
    ): Promise<number> {
      const lines = await db.journalLine.findMany({
        where: {
          accountId,
          journalEntry: {
            date: { lte: asOf },
            isReversal: false,
          },
        },
      });

      const totalDebit = lines.reduce(
        (sum, l) => sum + Number(l.debit),
        0
      );
      const totalCredit = lines.reduce(
        (sum, l) => sum + Number(l.credit),
        0
      );

      return normalBalance === "DEBIT"
        ? totalDebit - totalCredit
        : totalCredit - totalDebit;
    }

    const assetItems: BSLineItem[] = [];
    let totalAssets = 0;
    for (const account of assetAccounts) {
      const balance = await getAccountBalance(account.id, account.normalBalance);
      if (balance !== 0) {
        assetItems.push({
          label: account.name,
          code: account.code,
          amount: balance,
        });
        totalAssets += balance;
      }
    }

    const liabilityItems: BSLineItem[] = [];
    let totalLiabilities = 0;
    for (const account of liabilityAccounts) {
      const balance = await getAccountBalance(account.id, account.normalBalance);
      if (balance !== 0) {
        liabilityItems.push({
          label: account.name,
          code: account.code,
          amount: balance,
        });
        totalLiabilities += balance;
      }
    }

    const equityItems: BSLineItem[] = [];
    let totalEquity = 0;
    for (const account of equityAccounts) {
      const balance = await getAccountBalance(account.id, account.normalBalance);
      if (balance !== 0) {
        equityItems.push({
          label: account.name,
          code: account.code,
          amount: balance,
        });
        totalEquity += balance;
      }
    }

    // Add retained earnings (net income) to equity
    // Revenue - Expenses accounts
    const revenueAccounts = await db.account.findMany({
      where: { type: "REVENUE" },
      select: { id: true, normalBalance: true },
    });
    const allExpenseAccounts = await db.account.findMany({
      where: { type: "EXPENSE" },
      select: { id: true, normalBalance: true },
    });

    let totalRevenueNet = 0;
    for (const account of revenueAccounts) {
      const balance = await getAccountBalance(account.id, account.normalBalance);
      totalRevenueNet += balance;
    }
    let totalExpenseNet = 0;
    for (const account of allExpenseAccounts) {
      const balance = await getAccountBalance(account.id, account.normalBalance);
      totalExpenseNet += balance;
    }

    const retainedEarnings = totalRevenueNet - totalExpenseNet;
    if (retainedEarnings !== 0) {
      equityItems.push({
        label: "Retained Earnings",
        code: "RE",
        amount: retainedEarnings,
      });
      totalEquity += retainedEarnings;
    }

    const balanced =
      Math.round(totalAssets * 100) ===
      Math.round((totalLiabilities + totalEquity) * 100);

    return {
      success: true,
      data: {
        asOfDate: params.asOfDate,
        assets: { items: assetItems, total: totalAssets },
        liabilities: { items: liabilityItems, total: totalLiabilities },
        equity: { items: equityItems, total: totalEquity },
        balanced,
      },
    };
  } catch (error) {
    console.error("getBalanceSheet error:", error);
    return { success: false, error: "Failed to fetch balance sheet" };
  }
}

// ─── Cash Flow Report ────────────────────────────────────────────────────────

export type MonthlyCashFlow = {
  month: string;
  inflows: number;
  outflows: number;
  net: number;
};

export type CashFlowData = {
  monthly: MonthlyCashFlow[];
  totalInflows: number;
  totalOutflows: number;
  totalNet: number;
};

export async function getCashFlowReport(params: {
  startDate: string;
  endDate: string;
}): Promise<ActionResponse<CashFlowData>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };

    if (session.user.role !== "ADMIN") {
      return { success: false, error: "Insufficient permissions" };
    }

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);

    // Cash inflows: payments received (debit to cash accounts 1000, 1010, 1020)
    const cashAccounts = await db.account.findMany({
      where: {
        type: "ASSET",
        code: { in: ["1000", "1010", "1020"] },
      },
      select: { id: true },
    });

    const cashAccountIds = cashAccounts.map((a) => a.id);

    // Get all journal lines for cash accounts in date range
    const lines = await db.journalLine.findMany({
      where: {
        accountId: { in: cashAccountIds },
        journalEntry: {
          date: { gte: start, lte: end },
          isReversal: false,
        },
      },
      include: {
        journalEntry: { select: { date: true } },
      },
    });

    // Group by month
    const monthMap = new Map<
      string,
      { inflows: number; outflows: number }
    >();

    for (const line of lines) {
      const monthKey = line.journalEntry.date.toISOString().slice(0, 7);
      const existing = monthMap.get(monthKey) ?? { inflows: 0, outflows: 0 };

      const debit = Number(line.debit);
      const credit = Number(line.credit);

      // Debit to cash = inflow, Credit to cash = outflow
      existing.inflows += debit;
      existing.outflows += credit;
      monthMap.set(monthKey, existing);
    }

    const monthly: MonthlyCashFlow[] = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        inflows: data.inflows,
        outflows: data.outflows,
        net: data.inflows - data.outflows,
      }));

    const totalInflows = monthly.reduce((sum, m) => sum + m.inflows, 0);
    const totalOutflows = monthly.reduce((sum, m) => sum + m.outflows, 0);
    const totalNet = totalInflows - totalOutflows;

    return {
      success: true,
      data: {
        monthly,
        totalInflows,
        totalOutflows,
        totalNet,
      },
    };
  } catch (error) {
    console.error("getCashFlowReport error:", error);
    return { success: false, error: "Failed to fetch cash flow report" };
  }
}

// ─── Payment Method Report ───────────────────────────────────────────────────

export type PaymentMethodData = {
  method: string;
  count: number;
  total: number;
  percentage: number;
};

export type PaymentMethodReportData = {
  methods: PaymentMethodData[];
  grandTotal: number;
};

export async function getPaymentMethodReport(params: {
  startDate: string;
  endDate: string;
}): Promise<ActionResponse<PaymentMethodReportData>> {
  try {
    const session = await auth();
    if (!session?.user)
      return { success: false, error: "Unauthorized" };

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);

    const payments = await db.payment.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        order: { status: { not: "CANCELLED" } },
      },
    });

    const methodMap = new Map<string, { count: number; total: number }>();
    for (const payment of payments) {
      const method = payment.method;
      const existing = methodMap.get(method) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += Number(payment.amount);
      methodMap.set(method, existing);
    }

    const grandTotal = Array.from(methodMap.values()).reduce(
      (sum, m) => sum + m.total,
      0
    );

    const methods: PaymentMethodData[] = Array.from(methodMap.entries())
      .map(([method, data]) => ({
        method,
        count: data.count,
        total: data.total,
        percentage:
          grandTotal > 0
            ? Math.round((data.total / grandTotal) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      success: true,
      data: { methods, grandTotal },
    };
  } catch (error) {
    console.error("getPaymentMethodReport error:", error);
    return { success: false, error: "Failed to fetch payment method report" };
  }
}
