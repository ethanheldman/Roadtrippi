/**
 * Dedupe "Giant Paul Bunyan" (Bangor, ME): keep one, set correct image, remove duplicates.
 * Usage: from server directory: npx tsx scripts/dedupe-paul-bunyan-bangor.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BANGOR_PAUL_BUNYAN_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Paul_Bunyan_statue%2C_Bangor%2C_Maine.jpg/800px-Paul_Bunyan_statue%2C_Bangor%2C_Maine.jpg";
const BANGOR_PAUL_BUNYAN_SOURCE = "https://www.roadsideamerica.com/story/11266";

async function main() {
  const duplicates = await prisma.attraction.findMany({
    where: { name: "Giant Paul Bunyan", state: "ME" },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { checkIns: true, listItems: true, photos: true } },
    },
  });

  if (duplicates.length === 0) {
    console.log("No Giant Paul Bunyan (ME) found.");
    await prisma.$disconnect();
    return;
  }

  if (duplicates.length === 1) {
    await prisma.attraction.update({
      where: { id: duplicates[0]!.id },
      data: { imageUrl: BANGOR_PAUL_BUNYAN_IMAGE, sourceUrl: BANGOR_PAUL_BUNYAN_SOURCE },
    });
    console.log("Single Giant Paul Bunyan (ME) updated with image.");
    await prisma.$disconnect();
    return;
  }

  const [keep, ...toRemove] = duplicates;
  const keepId = keep!.id;

  console.log(`Keeping id=${keepId} (created ${keep!.createdAt}). Migrating relations from ${toRemove.length} duplicate(s)...`);

  for (const att of toRemove) {
    const dupId = att.id;

    await prisma.checkIn.updateMany({ where: { attractionId: dupId }, data: { attractionId: keepId } });
    await prisma.photo.updateMany({ where: { attractionId: dupId }, data: { attractionId: keepId } });

    const dupListItems = await prisma.listItem.findMany({ where: { attractionId: dupId } });
    for (const li of dupListItems) {
      const existing = await prisma.listItem.findUnique({
        where: { listId_attractionId: { listId: li.listId, attractionId: keepId } },
      });
      if (existing) await prisma.listItem.delete({ where: { id: li.id } });
      else await prisma.listItem.update({ where: { id: li.id }, data: { attractionId: keepId } });
    }

    const wantDups = await prisma.wantToVisit.findMany({ where: { attractionId: dupId } });
    for (const w of wantDups) {
      try {
        await prisma.wantToVisit.create({ data: { userId: w.userId, attractionId: keepId } });
      } catch {
        /* user already has keep in want-to-visit */
      }
    }
    await prisma.wantToVisit.deleteMany({ where: { attractionId: dupId } });

    await prisma.attractionCategory.deleteMany({ where: { attractionId: dupId } });
    await prisma.attraction.delete({ where: { id: dupId } });
    console.log(`  Removed duplicate id=${dupId}`);
  }

  await prisma.attraction.update({
    where: { id: keepId },
    data: { imageUrl: BANGOR_PAUL_BUNYAN_IMAGE, sourceUrl: BANGOR_PAUL_BUNYAN_SOURCE },
  });
  console.log("Updated kept attraction with correct image and source URL.");
  await prisma.$disconnect();
  console.log("Done. One Giant Paul Bunyan (Bangor, ME) with correct picture.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
