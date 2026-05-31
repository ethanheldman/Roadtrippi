/**
 * Supplemental dedup: merge rows that share the SAME sourceUrl AND the SAME
 * base name (ignoring "(Gone)/(Closed)/(In Transition)" suffixes) AND the same
 * state. Catches twins like "Space Station Museum" + "…(In Transition)" that
 * the city-keyed dedupe-attractions.ts misses when one twin's city is null.
 *
 * Grouping on (sourceUrl + baseName + state) is deliberately conservative: it
 * will NEVER merge the bogus rows that share a junk placeholder sourceUrl
 * (e.g. tip/12345 holds 20 *different* attractions) because their base names
 * differ. Reassigns check-ins/photos/list-items to the keeper before deleting.
 *
 *   cd server
 *   npx tsx scripts/dedupe-by-source-basename.ts --dry-run
 *   npx tsx scripts/dedupe-by-source-basename.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

function baseName(name: string | null): string {
  let s = (name || "").trim();
  const lower = s.toLowerCase();
  if (lower.endsWith(" (gone)")) s = s.slice(0, -7).trim();
  else if (lower.endsWith(" (closed)")) s = s.slice(0, -9).trim();
  else if (lower.endsWith(" (in transition)")) s = s.slice(0, -16).trim();
  return s.toLowerCase();
}
function hasStatusInName(a: { name: string | null }): boolean {
  return /\((?:gone|closed|in transition)\)/i.test(a.name || "");
}
const withImage = (a: { imageUrl: string | null }) => !!a.imageUrl && a.imageUrl.length > 0;

async function main() {
  const all = await prisma.attraction.findMany({
    where: { AND: [{ sourceUrl: { not: null } }, { sourceUrl: { not: "" } }] },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      imageUrl: true,
      sourceUrl: true,
      createdAt: true,
      _count: { select: { checkIns: true } },
    },
  });

  const groups = new Map<string, typeof all>();
  for (const a of all) {
    const k = `${a.sourceUrl}||${baseName(a.name)}||${(a.state || "").toUpperCase()}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  }
  const dupeGroups = [...groups.values()].filter((arr) => arr.length > 1);
  console.log(`Found ${dupeGroups.length} duplicate groups (sourceUrl|baseName|state).`);

  let removed = 0;
  for (const arr of dupeGroups) {
    const sorted = [...arr].sort((a, b) => {
      if (hasStatusInName(a) !== hasStatusInName(b)) return hasStatusInName(a) ? -1 : 1;
      if (withImage(a) !== withImage(b)) return withImage(a) ? -1 : 1;
      const ac = a._count.checkIns ?? 0;
      const bc = b._count.checkIns ?? 0;
      if (ac !== bc) return bc - ac;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    const keeper = sorted[0]!;
    for (const dup of sorted.slice(1)) {
      if (DRY_RUN) {
        console.log(`  [dry-run] keep "${keeper.name}" — remove "${dup.name}" (${dup.state}) ${dup.sourceUrl}`);
        removed++;
        continue;
      }
      const checkIns = await prisma.checkIn.findMany({
        where: { attractionId: dup.id },
        select: { id: true, userId: true, visitDate: true },
      });
      for (const c of checkIns) {
        const existing = await prisma.checkIn.findFirst({
          where: { attractionId: keeper.id, userId: c.userId, visitDate: c.visitDate },
        });
        if (existing) {
          await prisma.photo.updateMany({ where: { checkInId: c.id }, data: { checkInId: null, attractionId: keeper.id } });
          await prisma.comment.deleteMany({ where: { checkInId: c.id } });
          await prisma.checkIn.delete({ where: { id: c.id } });
        } else {
          await prisma.checkIn.update({ where: { id: c.id }, data: { attractionId: keeper.id } });
          await prisma.photo.updateMany({ where: { checkInId: c.id }, data: { attractionId: keeper.id } });
        }
      }
      await prisma.wantToVisit.deleteMany({ where: { attractionId: dup.id } });
      await prisma.listItem.deleteMany({ where: { attractionId: dup.id } });
      await prisma.attractionCategory.deleteMany({ where: { attractionId: dup.id } });
      await prisma.attraction.delete({ where: { id: dup.id } });
      removed++;
      console.log(`  Removed "${dup.name}" (${dup.state}); kept "${keeper.name}"`);
    }
  }

  await prisma.$disconnect();
  console.log(DRY_RUN ? `\n[dry-run] Would remove ${removed}.` : `\nDone. Removed ${removed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
