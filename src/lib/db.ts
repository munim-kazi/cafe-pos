import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function logDbDiagnostic() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.log("[db-diag] DATABASE_URL exists: NO");
    return;
  }
  try {
    const url = new URL(raw);
    console.log(`[db-diag] DATABASE_URL exists: YES`);
    console.log(`[db-diag] hostname = ${url.hostname}`);
    console.log(`[db-diag] port = ${url.port || "5432"}`);
    console.log(`[db-diag] database = ${url.pathname.replace(/^\//, "")}`);
  } catch {
    console.log("[db-diag] DATABASE_URL exists: YES but INVALID URL FORMAT");
  }
}

function createPrismaClient() {
  logDbDiagnostic();
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
