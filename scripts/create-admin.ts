import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "admin@cafe.com";
  const password = "CafeAdmin@2026!";

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: "ADMIN",
      active: true,
    },
    create: {
      name: "Administrator",
      email,
      password: hashedPassword,
      role: "ADMIN",
      active: true,
    },
  });

  console.log("Admin user created successfully!");
  console.log("Email:", user.email);
  console.log("Password:", password);
  console.log("Role:", user.role);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });