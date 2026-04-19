import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Find the first merchant
  const merchant = await prisma.merchant.findFirst();
  if (!merchant) {
    console.error("No merchant found. Create a merchant first.");
    process.exit(1);
  }
  console.log(`Seeding data for merchant: ${merchant.name} (${merchant.id})`);

  // Create a category first
  const category = await prisma.category.upsert({
    where: { merchantId_name: { merchantId: merchant.id, name: "General" } },
    update: {},
    create: {
      merchantId: merchant.id,
      name: "General",
      color: "#6366f1",
    },
  });

  // 10 Products
  const products = [
    {
      name: "Rice 1kg",
      sku: "RICE-1KG",
      price: 5000,
      costPrice: 3500,
      stock: 50,
    },
    {
      name: "Sugar 1kg",
      sku: "SUGAR-1KG",
      price: 4000,
      costPrice: 2800,
      stock: 40,
    },
    {
      name: "Cooking Oil 1L",
      sku: "OIL-1L",
      price: 8000,
      costPrice: 6000,
      stock: 30,
    },
    {
      name: "Tea 250g",
      sku: "TEA-250G",
      price: 3000,
      costPrice: 1800,
      stock: 60,
    },
    {
      name: "Coffee 200g",
      sku: "COFFEE-200G",
      price: 7000,
      costPrice: 4500,
      stock: 25,
    },
    {
      name: "Flour 2kg",
      sku: "FLOUR-2KG",
      price: 3500,
      costPrice: 2200,
      stock: 45,
    },
    {
      name: "Salt 500g",
      sku: "SALT-500G",
      price: 1000,
      costPrice: 600,
      stock: 100,
    },
    {
      name: "Pasta 500g",
      sku: "PASTA-500G",
      price: 2500,
      costPrice: 1500,
      stock: 55,
    },
    {
      name: "Tomato Paste 400g",
      sku: "TPASTE-400G",
      price: 3000,
      costPrice: 2000,
      stock: 35,
    },
    {
      name: "Soap Bar",
      sku: "SOAP-BAR",
      price: 1500,
      costPrice: 900,
      stock: 80,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { merchantId_sku: { merchantId: merchant.id, sku: p.sku } },
      update: {},
      create: {
        merchantId: merchant.id,
        categoryId: category.id,
        name: p.name,
        sku: p.sku,
        price: p.price,
        costPrice: p.costPrice,
        stock: p.stock,
      },
    });
  }
  console.log("✓ 10 products seeded");

  // 10 Customers
  const customers = [
    { name: "Ahmad Hassan", phone: "+963911111111" },
    { name: "Fatima Ali", phone: "+963922222222" },
    { name: "Omar Khalil", phone: "+963933333333" },
    { name: "Layla Ibrahim", phone: "+963944444444" },
    { name: "Khaled Nasser", phone: "+963955555555" },
    { name: "Sara Mahmoud", phone: "+963966666666" },
    { name: "Yousef Saleh", phone: "+963977777777" },
    { name: "Hana Rajab", phone: "+963988888888" },
    { name: "Mazen Darwish", phone: "+963999999999" },
    { name: "Nour Amin", phone: "+963900000000" },
  ];

  for (const c of customers) {
    const exists = await prisma.customer.findFirst({
      where: { merchantId: merchant.id, phone: c.phone },
    });
    if (!exists) {
      await prisma.customer.create({
        data: {
          merchantId: merchant.id,
          name: c.name,
          phone: c.phone,
        },
      });
    }
  }
  console.log("✓ 10 customers seeded");

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
