/**
 * Remove duplicate Eddie World (Yermo, CA) attractions. Keeps the oldest one.
 * Usage: npm run dedupe-eddie-world  (from server directory)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const duplicates = await prisma.attraction.findMany({
    where: { name: "Eddie World", state: "CA" },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { checkIns: true, listItems: true } } },
  });

  if (duplicates.length <= 1) {
    console.log(`Only ${duplicates.length} Eddie World found. Nothing to dedupe.`);
    await prisma.$disconnect();
    return;
  }

  const [keep, ...toDelete] = duplicates;
  console.log(`Keeping Eddie World id=${keep.id} (created ${keep.createdAt}).`);
  console.log(`Deleting ${toDelete.length} duplicate(s)...`);

  for (const att of toDelete) {
    await prisma.attraction.delete({ where: { id: att.id } });
    console.log(`  Deleted id=${att.id}`);
  }

  await prisma.$disconnect();
  console.log("Done. One Eddie World remains.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
