/**
 * Deduplicate attractions: for each (name, state, city) keep one record,
 * prefer the one with image and most check-ins. Reassign check-ins/photos to keeper, then delete duplicates.
 * Run: npx tsx server/scripts/dedupe-attractions.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

function norm(s: string | null): string {
  return (s || "").trim().toLowerCase();
}
function normState(s: string | null): string {
  return (s || "").trim().toUpperCase();
}

async function main() {
  const all = await prisma.attraction.findMany({
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      imageUrl: true,
      createdAt: true,
      _count: { select: { checkIns: true } },
    },
    orderBy: [{ state: "asc" }, { name: "asc" }],
  });

  const key = (a: { name: string | null; state: string | null; city: string | null }) =>
    (a.name || "").trim() + "|" + normState(a.state) + "|" + norm(a.city);

  const groups = new Map<string, typeof all>();
  for (const a of all) {
    const k = key(a);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  }

  const duplicateGroups = [...groups.entries()].filter(([, arr]) => arr.length > 1);
  console.log(`Found ${duplicateGroups.length} duplicate groups (name|state|city).`);

  let totalDeleted = 0;
  for (const [groupKey, arr] of duplicateGroups) {
    const [name, state, city] = groupKey.split("|");
    const withImage = (a: { imageUrl: string | null }) => !!a.imageUrl && a.imageUrl.length > 0;
    const sorted = [...arr].sort((a, b) => {
      if (withImage(a) !== withImage(b)) return withImage(a) ? -1 : 1;
      const ac = a._count.checkIns ?? 0;
      const bc = b._count.checkIns ?? 0;
      if (ac !== bc) return bc - ac;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    const keeper = sorted[0]!;
    const toRemove = sorted.slice(1);

    for (const dup of toRemove) {
      if (DRY_RUN) {
        console.log(`  [dry-run] Would remove duplicate: ${dup.id} (${name}, ${state})`);
        totalDeleted++;
        continue;
      }

      const checkIns = await prisma.checkIn.findMany({
        where: { attractionId: dup.id },
        select: { id: true, userId: true, visitDate: true },
      });

      for (const c of checkIns) {
        const existing = await prisma.checkIn.findFirst({
          where: {
            attractionId: keeper.id,
            userId: c.userId,
            visitDate: c.visitDate,
          },
        });
        if (existing) {
          await prisma.photo.updateMany({ where: { checkInId: c.id }, data: { checkInId: null, attractionId: keeper.id } });
          await prisma.comment.deleteMany({ where: { checkInId: c.id } });
          await prisma.checkIn.delete({ where: { id: c.id } });
        } else {
          await prisma.checkIn.update({
            where: { id: c.id },
            data: { attractionId: keeper.id },
          });
          await prisma.photo.updateMany({
            where: { checkInId: c.id },
            data: { attractionId: keeper.id },
          });
        }
      }

      await prisma.wantToVisit.deleteMany({ where: { attractionId: dup.id } });
      await prisma.listItem.deleteMany({ where: { attractionId: dup.id } });
      await prisma.attractionCategory.deleteMany({ where: { attractionId: dup.id } });
      await prisma.attraction.delete({ where: { id: dup.id } });
      totalDeleted++;
      console.log(`  Removed duplicate: ${name} (${state}) id=${dup.id}`);
    }
  }

  await prisma.$disconnect();
  console.log(DRY_RUN ? `[dry-run] Would remove ${totalDeleted} duplicate attractions.` : `Done. Removed ${totalDeleted} duplicate attractions.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
