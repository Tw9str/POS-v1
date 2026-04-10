import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

function getPool() {
  if (!globalForPrisma.pool) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL!,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });

    // Prevent unhandled errors from crashing the process
    pool.on("error", (err) => {
      console.error("pg pool error:", err.message);
    });

    globalForPrisma.pool = pool;
  }
  return globalForPrisma.pool;
}

function makePrisma() {
  const adapter = new PrismaPg(getPool());
  return new PrismaClient({ adapter, log: ["error", "warn"] });
}

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
