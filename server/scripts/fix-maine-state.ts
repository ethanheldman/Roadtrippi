/**
 * One-time fix: set state = 'ME' for any attraction with state = 'Maine'.
 * Run from server: npx tsx scripts/fix-maine-state.ts
 */

import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const result = await prisma.attraction.updateMany({
    where: { state: "Maine" },
    data: { state: "ME" },
  });
  console.log(`Updated ${result.count} attraction(s) from state 'Maine' to 'ME'.`);
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
