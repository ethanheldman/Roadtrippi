/**
 * Deduplicate attractions: for each (name, state, city) keep one record.
 * When one has (Gone) or (Closed) in the name and another doesn't, keep the one with parentheses.
 * Otherwise prefer image, then most check-ins. Reassign check-ins/photos to keeper, then delete duplicates.
 * Run: npx tsx server/scripts/dedupe-attractions.ts [--dry-run] [--state ME]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const stateArgIdx = process.argv.indexOf("--state");
const STATE_FILTER = stateArgIdx >= 0 && process.argv[stateArgIdx + 1]
  ? process.argv[stateArgIdx + 1].trim().toUpperCase()
  : null;

function norm(s: string | null): string {
  return (s || "").trim().toLowerCase();
}
function normState(s: string | null): string {
  return (s || "").trim().toUpperCase();
}

/** Strip " (Gone)", " (Closed)", " (In Transition)" for grouping same attraction. */
function baseName(name: string | null): string {
  let s = (name || "").trim();
  const lower = s.toLowerCase();
  if (lower.endsWith(" (gone)")) s = s.slice(0, -7).trim();
  else if (lower.endsWith(" (closed)")) s = s.slice(0, -9).trim();
  else if (lower.endsWith(" (in transition)")) s = s.slice(0, -16).trim();
  return s;
}

/** Prefer keeping the record whose name has (Gone) or (Closed) or (In Transition). */
function hasStatusInName(a: { name: string | null }): boolean {
  return /\((?:gone|closed|in transition)\)/i.test(a.name || "");
}

async function main() {
  const all = await prisma.attraction.findMany({
    where: STATE_FILTER ? { state: STATE_FILTER } : undefined,
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
  if (STATE_FILTER) console.log(`Filtering to state: ${STATE_FILTER} (${all.length} attractions).`);

  const key = (a: { name: string | null; state: string | null; city: string | null }) =>
    baseName(a.name) + "|" + normState(a.state) + "|" + norm(a.city);

  const groups = new Map<string, typeof all>();
  for (const a of all) {
    const k = key(a);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  }

  const duplicateGroups = [...groups.entries()].filter(([, arr]) => arr.length > 1);
  console.log(`Found ${duplicateGroups.length} duplicate groups (baseName|state|city).`);

  let totalDeleted = 0;
  const withImage = (a: { imageUrl: string | null }) => !!a.imageUrl && a.imageUrl.length > 0;
  for (const [groupKey, arr] of duplicateGroups) {
    const [base, state, city] = groupKey.split("|");
    const sorted = [...arr].sort((a, b) => {
      if (hasStatusInName(a) !== hasStatusInName(b)) return hasStatusInName(a) ? -1 : 1;
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
        console.log(`  [dry-run] Would remove duplicate: ${dup.id} (${dup.name}, ${state})`);
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
      console.log(`  Removed duplicate: ${dup.name} (${state}) id=${dup.id}`);
    }
  }

  await prisma.$disconnect();
  console.log(DRY_RUN ? `[dry-run] Would remove ${totalDeleted} duplicate attractions.` : `Done. Removed ${totalDeleted} duplicate attractions.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
