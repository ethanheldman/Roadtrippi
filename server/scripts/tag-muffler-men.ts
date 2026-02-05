/**
 * Tag all attractions whose name contains "muffler man" with the Muffler Man category.
 * Run from repo root: npx tsx server/scripts/tag-muffler-men.ts
 */

import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  const cat = await prisma.category.findFirst({ where: { slug: "muffler-man" } });
  if (!cat) {
    console.error("Category muffler-man not found.");
    process.exit(1);
  }

  const attractions = await prisma.attraction.findMany({
    where: { name: { contains: "muffler man", mode: "insensitive" } },
    select: { id: true, name: true },
  });

  console.log(`Found ${attractions.length} attractions with "muffler man" in name.`);

  const existing = await prisma.attractionCategory.findMany({
    where: { categoryId: cat.id, attractionId: { in: attractions.map((a) => a.id) } },
    select: { attractionId: true },
  });
  const existingIds = new Set(existing.map((e) => e.attractionId));
  const toAdd = attractions.filter((a) => !existingIds.has(a.id));

  if (toAdd.length > 0) {
    await prisma.attractionCategory.createMany({
      data: toAdd.map((a) => ({ attractionId: a.id, categoryId: cat.id })),
      skipDuplicates: true,
    });
    toAdd.forEach((a) => console.log("  Tagged:", a.name));
  }

  await prisma.$disconnect();
  console.log(`Done. Tagged ${toAdd.length} attractions with Muffler Man.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
