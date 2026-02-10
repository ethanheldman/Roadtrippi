/**
 * Remove duplicate "Abandoned Waterpark, Guerrilla Art Site" (same as Lake Dolores Waterpark).
 * Usage: from server directory: npx tsx scripts/remove-abandoned-waterpark-duplicate.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.attraction.deleteMany({
    where: {
      name: "Abandoned Waterpark, Guerrilla Art Site",
      city: "Newberry Springs",
      state: "CA",
    },
  });
  console.log(`Removed ${result.count} duplicate attraction(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
