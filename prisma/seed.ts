import { PrismaClient } from "../src/generated/prisma/client";
import { Role } from "../src/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const ACCOUNTS = [
  { code: "1000", name: "Cash on Hand", type: "ASSET" as const, normalBalance: "DEBIT" as const },
  { code: "1010", name: "Cash in Bank", type: "ASSET" as const, normalBalance: "DEBIT" as const },
  { code: "1020", name: "Mobile Wallet", type: "ASSET" as const, normalBalance: "DEBIT" as const },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" as const, normalBalance: "DEBIT" as const },
  { code: "1200", name: "Inventory", type: "ASSET" as const, normalBalance: "DEBIT" as const },
  { code: "1300", name: "Prepaid Expenses", type: "ASSET" as const, normalBalance: "DEBIT" as const },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY" as const, normalBalance: "CREDIT" as const },
  { code: "2100", name: "Tax/VAT Payable", type: "LIABILITY" as const, normalBalance: "CREDIT" as const },
  { code: "2200", name: "Customer Deposits", type: "LIABILITY" as const, normalBalance: "CREDIT" as const },
  { code: "3000", name: "Owner's Equity", type: "EQUITY" as const, normalBalance: "CREDIT" as const },
  { code: "3100", name: "Retained Earnings", type: "EQUITY" as const, normalBalance: "CREDIT" as const },
  { code: "4000", name: "Sales Revenue", type: "REVENUE" as const, normalBalance: "CREDIT" as const },
  { code: "4100", name: "Sales Discount", type: "REVENUE" as const, normalBalance: "DEBIT" as const },
  { code: "4200", name: "Other Income", type: "REVENUE" as const, normalBalance: "CREDIT" as const },
  { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE" as const, normalBalance: "DEBIT" as const },
  { code: "5100", name: "Purchase (Inventory)", type: "EXPENSE" as const, normalBalance: "DEBIT" as const },
  { code: "5200", name: "Purchase Discount", type: "EXPENSE" as const, normalBalance: "CREDIT" as const },
  { code: "5300", name: "Discount Allowed", type: "EXPENSE" as const, normalBalance: "DEBIT" as const },
  { code: "5400", name: "Refund Expense", type: "EXPENSE" as const, normalBalance: "DEBIT" as const },
  { code: "5500", name: "Waste/Loss", type: "EXPENSE" as const, normalBalance: "DEBIT" as const },
  { code: "6000", name: "Rent Expense", type: "EXPENSE" as const, normalBalance: "DEBIT" as const },
  { code: "6100", name: "Salary & Wages", type: "EXPENSE" as const, normalBalance: "DEBIT" as const },
  { code: "6200", name: "Utilities", type: "EXPENSE" as const, normalBalance: "DEBIT" as const },
  { code: "6300", name: "Supplies", type: "EXPENSE" as const, normalBalance: "DEBIT" as const },
  { code: "6900", name: "Other Expenses", type: "EXPENSE" as const, normalBalance: "DEBIT" as const },
];

const CATEGORIES = [
  { name: "Hot Drinks", sortOrder: 1 },
  { name: "Cold Drinks", sortOrder: 2 },
  { name: "Food", sortOrder: 3 },
  { name: "Desserts", sortOrder: 4 },
];

const TABLES = [
  { number: 1, capacity: 2, section: "Indoor" },
  { number: 2, capacity: 2, section: "Indoor" },
  { number: 3, capacity: 4, section: "Indoor" },
  { number: 4, capacity: 4, section: "Indoor" },
  { number: 5, capacity: 6, section: "Indoor" },
  { number: 6, capacity: 4, section: "Outdoor" },
  { number: 7, capacity: 4, section: "Outdoor" },
  { number: 8, capacity: 8, section: "Outdoor" },
];

async function main() {
  console.log("Testing Prisma connection...");

  await prisma.$queryRaw`SELECT 1`;

  console.log("Prisma connection OK");

  console.log("Seeding database...");

  const password = await bcrypt.hash("admin123", 12);
  const cashierPassword = await bcrypt.hash("cashier123", 12);
  const kitchenPassword = await bcrypt.hash("kitchen123", 12);

  await prisma.user.createMany({
    data: [
      { name: "Admin", email: "admin@cafe.com", password, role: Role.ADMIN },
      { name: "Manager", email: "manager@cafe.com", password, role: Role.MANAGER },
      { name: "Cashier", email: "cashier@cafe.com", password: cashierPassword, role: Role.CASHIER },
      { name: "Kitchen", email: "kitchen@cafe.com", password: kitchenPassword, role: Role.KITCHEN },
    ],
    skipDuplicates: true,
  });

  console.log("Users created");

  for (const account of ACCOUNTS) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: {},
      create: account,
    });
  }

  console.log("Chart of Accounts seeded");

  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }

  console.log("Categories created");

  const hotDrinks = await prisma.category.findUnique({ where: { name: "Hot Drinks" } });
  const coldDrinks = await prisma.category.findUnique({ where: { name: "Cold Drinks" } });
  const food = await prisma.category.findUnique({ where: { name: "Food" } });

  if (hotDrinks) {
    await prisma.menuItem.createMany({
      data: [
        { name: "Espresso", categoryId: hotDrinks.id, basePrice: 120 },
        { name: "Cappuccino", categoryId: hotDrinks.id, basePrice: 180 },
        { name: "Latte", categoryId: hotDrinks.id, basePrice: 200 },
        { name: "Americano", categoryId: hotDrinks.id, basePrice: 150 },
      ],
      skipDuplicates: true,
    });
  }

  if (coldDrinks) {
    await prisma.menuItem.createMany({
      data: [
        { name: "Iced Coffee", categoryId: coldDrinks.id, basePrice: 180 },
        { name: "Mango Smoothie", categoryId: coldDrinks.id, basePrice: 220 },
        { name: "Fresh Lime Soda", categoryId: coldDrinks.id, basePrice: 100 },
      ],
      skipDuplicates: true,
    });
  }

  if (food) {
    await prisma.menuItem.createMany({
      data: [
        { name: "Club Sandwich", categoryId: food.id, basePrice: 350 },
        { name: "Chicken Burger", categoryId: food.id, basePrice: 380 },
        { name: "Margherita Pizza", categoryId: food.id, basePrice: 450 },
      ],
      skipDuplicates: true,
    });
  }

  console.log("Menu items created");

  await prisma.table.createMany({ data: TABLES, skipDuplicates: true });
  console.log("Tables created");

  const cappuccino = await prisma.menuItem.findFirst({ where: { name: "Cappuccino" } });
  const espresso = await prisma.menuItem.findFirst({ where: { name: "Espresso" } });

  const coffeeBean = await prisma.ingredient.upsert({
    where: { name: "Coffee Beans" },
    update: {},
    create: { name: "Coffee Beans", unit: "gm", costPerUnit: 0.5, lowStockThreshold: 500 },
  });

  const milk = await prisma.ingredient.upsert({
    where: { name: "Milk" },
    update: {},
    create: { name: "Milk", unit: "ml", costPerUnit: 0.08, lowStockThreshold: 2000 },
  });

  const sugar = await prisma.ingredient.upsert({
    where: { name: "Sugar" },
    update: {},
    create: { name: "Sugar", unit: "gm", costPerUnit: 0.02, lowStockThreshold: 1000 },
  });

  console.log("Ingredients created");

  if (cappuccino) {
    await prisma.recipe.createMany({
      data: [
        { menuItemId: cappuccino.id, ingredientId: coffeeBean.id, quantity: 18 },
        { menuItemId: cappuccino.id, ingredientId: milk.id, quantity: 200 },
        { menuItemId: cappuccino.id, ingredientId: sugar.id, quantity: 10 },
      ],
      skipDuplicates: true,
    });
  }

  if (espresso) {
    await prisma.recipe.createMany({
      data: [
        { menuItemId: espresso.id, ingredientId: coffeeBean.id, quantity: 18 },
      ],
      skipDuplicates: true,
    });
  }

  console.log("Recipes created");
  console.log("Seed complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
