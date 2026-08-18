import type { JournalLineInput } from "./validation";

interface AccountCodes {
  cashOnHand: string;
  cashInBank: string;
  mobileWallet: string;
  accountsReceivable: string;
  accountsPayable: string;
  inventory: string;
  salesRevenue: string;
  salesDiscount: string;
  taxPayable: string;
  cogs: string;
  wasteLoss: string;
  purchaseDiscount: string;
}

const DEFAULT_CODES: AccountCodes = {
  cashOnHand: "1000",
  cashInBank: "1010",
  mobileWallet: "1020",
  accountsReceivable: "1100",
  accountsPayable: "2000",
  taxPayable: "2100",
  inventory: "1200",
  salesRevenue: "4000",
  salesDiscount: "4100",
  cogs: "5000",
  wasteLoss: "5500",
  purchaseDiscount: "5200",
};

function code(accounts: AccountCodes, key: keyof AccountCodes): string {
  return accounts[key];
}

export function cashSale(
  amount: number,
  accountId: string,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    { accountId, debit: amount, credit: 0, description: "Cash sale" },
    {
      accountId: code(accounts, "salesRevenue"),
      debit: 0,
      credit: amount,
      description: "Sales revenue",
    },
  ];
}

export function cashSaleWithTax(
  saleAmount: number,
  taxAmount: number,
  accountId: string,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    {
      accountId,
      debit: saleAmount + taxAmount,
      credit: 0,
      description: "Cash received (incl. tax)",
    },
    {
      accountId: code(accounts, "salesRevenue"),
      debit: 0,
      credit: saleAmount,
      description: "Sales revenue",
    },
    {
      accountId: code(accounts, "taxPayable"),
      debit: 0,
      credit: taxAmount,
      description: "Tax/VAT payable",
    },
  ];
}

export function saleWithDiscount(
  saleAmount: number,
  discountAmount: number,
  receivedAmount: number,
  accountId: string,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    {
      accountId,
      debit: receivedAmount,
      credit: 0,
      description: "Amount received",
    },
    {
      accountId: code(accounts, "salesDiscount"),
      debit: discountAmount,
      credit: 0,
      description: "Sales discount",
    },
    {
      accountId: code(accounts, "salesRevenue"),
      debit: 0,
      credit: saleAmount,
      description: "Sales revenue",
    },
  ];
}

export function cardMobilePayment(
  amount: number,
  accountId: string,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    {
      accountId,
      debit: amount,
      credit: 0,
      description: "Card/mobile payment received",
    },
    {
      accountId: code(accounts, "salesRevenue"),
      debit: 0,
      credit: amount,
      description: "Sales revenue",
    },
  ];
}

export function creditSale(
  amount: number,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    {
      accountId: code(accounts, "accountsReceivable"),
      debit: amount,
      credit: 0,
      description: "Accounts receivable",
    },
    {
      accountId: code(accounts, "salesRevenue"),
      debit: 0,
      credit: amount,
      description: "Sales revenue (credit)",
    },
  ];
}

export function customerPayment(
  amount: number,
  accountId: string,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    { accountId, debit: amount, credit: 0, description: "Customer payment" },
    {
      accountId: code(accounts, "accountsReceivable"),
      debit: 0,
      credit: amount,
      description: "Reduce accounts receivable",
    },
  ];
}

export function cashPurchase(
  amount: number,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    {
      accountId: code(accounts, "inventory"),
      debit: amount,
      credit: 0,
      description: "Inventory purchased",
    },
    {
      accountId: code(accounts, "cashOnHand"),
      debit: 0,
      credit: amount,
      description: "Cash payment",
    },
  ];
}

export function creditPurchase(
  amount: number,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    {
      accountId: code(accounts, "inventory"),
      debit: amount,
      credit: 0,
      description: "Inventory purchased (credit)",
    },
    {
      accountId: code(accounts, "accountsPayable"),
      debit: 0,
      credit: amount,
      description: "Accounts payable",
    },
  ];
}

export function paySupplier(
  amount: number,
  accountId: string,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    {
      accountId: code(accounts, "accountsPayable"),
      debit: amount,
      credit: 0,
      description: "Pay supplier",
    },
    { accountId, debit: 0, credit: amount, description: "Payment to supplier" },
  ];
}

export function expense(
  amount: number,
  accountId: string,
  expenseAccountId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    {
      accountId: expenseAccountId,
      debit: amount,
      credit: 0,
      description: "Expense",
    },
    { accountId, debit: 0, credit: amount, description: "Payment for expense" },
  ];
}

export function cogsEntry(
  amount: number,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    {
      accountId: code(accounts, "cogs"),
      debit: amount,
      credit: 0,
      description: "Cost of goods sold",
    },
    {
      accountId: code(accounts, "inventory"),
      debit: 0,
      credit: amount,
      description: "Reduce inventory",
    },
  ];
}

export function fullRefund(
  saleAmount: number,
  taxAmount: number,
  accountId: string,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  const lines: JournalLineInput[] = [
    {
      accountId: code(accounts, "salesRevenue"),
      debit: saleAmount,
      credit: 0,
      description: "Reverse sales revenue",
    },
  ];

  if (taxAmount > 0) {
    lines.push({
      accountId: code(accounts, "taxPayable"),
      debit: taxAmount,
      credit: 0,
      description: "Reverse tax payable",
    });
  }

  lines.push({
    accountId,
    debit: 0,
    credit: saleAmount + taxAmount,
    description: "Refund paid to customer",
  });

  return lines;
}

export function partialRefund(
  refundAmount: number,
  accountId: string,
  taxAmount: number = 0,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  const lines: JournalLineInput[] = [
    {
      accountId: code(accounts, "salesRevenue"),
      debit: refundAmount,
      credit: 0,
      description: "Partial reversal of sales revenue",
    },
  ];

  if (taxAmount > 0) {
    lines.push({
      accountId: code(accounts, "taxPayable"),
      debit: taxAmount,
      credit: 0,
      description: "Reverse tax payable (partial)",
    });
  }

  lines.push({
    accountId,
    debit: 0,
    credit: refundAmount + taxAmount,
    description: "Partial refund paid",
  });

  return lines;
}

export function stockAdjustment(
  amount: number,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    {
      accountId: code(accounts, "wasteLoss"),
      debit: amount,
      credit: 0,
      description: "Stock adjustment / shrinkage",
    },
    {
      accountId: code(accounts, "inventory"),
      debit: 0,
      credit: amount,
      description: "Reduce inventory",
    },
  ];
}

export function wasteEntry(
  amount: number,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    {
      accountId: code(accounts, "wasteLoss"),
      debit: amount,
      credit: 0,
      description: "Waste / spoilage",
    },
    {
      accountId: code(accounts, "inventory"),
      debit: 0,
      credit: amount,
      description: "Reduce inventory",
    },
  ];
}

export function stockReturn(
  amount: number,
  accounts: AccountCodes = DEFAULT_CODES
): JournalLineInput[] {
  return [
    {
      accountId: code(accounts, "accountsPayable"),
      debit: amount,
      credit: 0,
      description: "Reduce payable (return)",
    },
    {
      accountId: code(accounts, "inventory"),
      debit: 0,
      credit: amount,
      description: "Return inventory to supplier",
    },
  ];
}
