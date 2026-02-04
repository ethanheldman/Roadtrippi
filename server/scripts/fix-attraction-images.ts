/**
 * Fix Fremont Troll and Cabazon Dinosaurs so they show pictures:
 * - If duplicates exist, keep the one with check-ins/favorites and delete the other(s).
 * - Set imageUrl on the kept record so the card shows the hosted image.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIXES: { name: string; state: string; imageUrl: string }[] = [
  { name: "Fremont Troll", state: "WA", imageUrl: "/uploads/attractions/fremont-troll.jpg" },
  { name: "Cabazon Dinosaurs", state: "CA", imageUrl: "/uploads/attractions/cabazon-dinosaurs.jpg" },
];

async function main() {
  for (const { name, state, imageUrl } of FIXES) {
    const matches = await prisma.attraction.findMany({
      where: { name, state },
      include: {
        _count: { select: { checkIns: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    if (matches.length === 0) continue;
    // Keep the one with check-ins (user data); delete duplicates with 0 check-ins
    const toKeep = matches.reduce((best, a) =>
      (a._count.checkIns ?? 0) > (best._count.checkIns ?? 0) ? a : best
    );
    const toDelete = matches.filter((a) => a.id !== toKeep.id);
    for (const att of toDelete) {
      await prisma.attractionCategory.deleteMany({ where: { attractionId: att.id } });
      await prisma.attraction.delete({ where: { id: att.id } });
      console.log(`Deleted duplicate ${name}, ${state} (id ${att.id}).`);
    }
    await prisma.attraction.update({
      where: { id: toKeep.id },
      data: { imageUrl },
    });
    console.log(`Set image for ${name}, ${state}.`);
  }
  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
