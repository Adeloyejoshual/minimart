import prisma from "../src/prismaClient.js";

async function main() {
  await prisma.miniMartProduct.createMany({
    data: [
      {
        name: "Rice (50kg)",
        price: 65000,
        category: "Food",
        image: "https://via.placeholder.com/300",
      },
      {
        name: "Cooking Oil (5L)",
        price: 12000,
        category: "Groceries",
        image: "https://via.placeholder.com/300",
      },
      {
        name: "Indomie Noodles (Carton)",
        price: 8500,
        category: "Food",
        image: "https://via.placeholder.com/300",
      },
    ],
  });

  console.log("✅ MiniMart products seeded");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });