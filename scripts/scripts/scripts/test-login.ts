import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "admin@cafe.com";
  const password = "Admin@12345";

  const user = await prisma.user.findUnique({
    where: { email },
  });

  console.log("USER FOUND:", !!user);

  if (!user) {
    console.log("❌ User not found");
    return;
  }

  console.log("Email:", user.email);
  console.log("Name:", user.name);
  console.log("Role:", user.role);
  console.log("Active:", user.active);
  console.log("Password hash exists:", !!user.password);
  console.log(
    "Password valid:",
    await bcrypt.compare(password, user.password)
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());