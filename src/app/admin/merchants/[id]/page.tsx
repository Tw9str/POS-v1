import MerchantDetailClient from "./MerchantDetailClient";
import { prisma } from "@/lib/db";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const merchant = await prisma.merchant.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: merchant?.name ?? "Merchant Details" };
}

export default function MerchantDetailPage() {
  return <MerchantDetailClient />;
}
