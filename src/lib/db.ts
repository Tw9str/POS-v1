import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_GRACE_PERIOD_DAYS } from "@/lib/constants";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Fetch the global grace period (days) from SystemSettings. Falls back to DEFAULT_GRACE_PERIOD_DAYS. */
export async function getGracePeriodDays(): Promise<number> {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { gracePeriodDays: true },
    });
    return settings?.gracePeriodDays ?? DEFAULT_GRACE_PERIOD_DAYS;
  } catch {
    return DEFAULT_GRACE_PERIOD_DAYS;
  }
}
