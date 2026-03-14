/**
 * Dedupe Fremont Troll (Seattle, WA): keep one with image, remove the rest.
 * Handles both "Fremont Troll" and "The Fremont Troll".
 * Usage: from server directory: npx tsx scripts/dedupe-fremont-troll.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FREMONT_TROLL_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Fremont_Troll_2011.jpg/800px-Fremont_Troll_2011.jpg";
const FREMONT_TROLL_SOURCE = "https://www.roadsideamerica.com/location/wa";

async function main() {
  const candidates = await prisma.attraction.findMany({
    where: {
      state: "WA",
      OR: [
        { name: "Fremont Troll" },
        { name: "The Fremont Troll" },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (candidates.length <= 1) {
    if (candidates.length === 1) {
      await prisma.attraction.update({
        where: { id: candidates[0]!.id },
        data: {
          name: "Fremont Troll",
          imageUrl: FREMONT_TROLL_IMAGE,
          sourceUrl: FREMONT_TROLL_SOURCE,
        },
      });
      console.log("Single Fremont Troll (WA) updated with canonical name and image.");
    } else {
      console.log("No Fremont Troll (WA) found.");
    }
    await prisma.$disconnect();
    return;
  }

  // Keep the one that has an image; if tie, prefer "Fremont Troll" then oldest
  const withImage = candidates.filter((a) => a.imageUrl && a.imageUrl.length > 0);
  const keepCandidate = withImage.length > 0
    ? withImage.find((a) => a.name === "Fremont Troll") ?? withImage[0]!
    : candidates[0]!;
  const toRemove = candidates.filter((a) => a.id !== keepCandidate.id);
  const keepId = keepCandidate.id;

  console.log(`Keeping id=${keepId} (${keepCandidate.name}, has image: ${!!keepCandidate.imageUrl}). Migrating relations from ${toRemove.length} duplicate(s)...`);

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
    console.log(`  Removed duplicate id=${dupId} (${att.name})`);
  }

  await prisma.attraction.update({
    where: { id: keepId },
    data: {
      name: "Fremont Troll",
      imageUrl: FREMONT_TROLL_IMAGE,
      sourceUrl: FREMONT_TROLL_SOURCE,
    },
  });
  console.log("Updated kept attraction with canonical name and image.");
  await prisma.$disconnect();
  console.log("Done. One Fremont Troll (Seattle, WA) with correct picture.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
