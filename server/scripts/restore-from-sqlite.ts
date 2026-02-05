/**
 * One-time restore: copy attractions from the old SQLite DB (prisma/prisma/dev.db)
 * into the current database (Neon). Skips duplicates by sourceUrl.
 * Run from server dir: npx tsx scripts/restore-from-sqlite.ts
 */

import Database from "better-sqlite3";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const SQLITE_PATH = join(process.cwd(), "prisma", "prisma", "dev.db");
const prisma = new PrismaClient();

async function main() {
  const db = new Database(SQLITE_PATH, { readonly: true });
  const attractions = db.prepare("SELECT * FROM attractions").all() as Array<{
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    city: string | null;
    state: string;
    latitude: number | null;
    longitude: number | null;
    image_url: string | null;
    source_url: string | null;
    created_at: string;
  }>;
  db.close();

  console.log(`SQLite has ${attractions.length} attractions.`);

  const existingUrls = new Set(
    (await prisma.attraction.findMany({ where: { sourceUrl: { not: null } }, select: { sourceUrl: true } }))
      .map((a) => a.sourceUrl!)
  );
  console.log(`Neon already has ${existingUrls.size} attractions with sourceUrl.`);

  let roadCat = await prisma.category.findFirst({ where: { slug: "roadside-oddities" } });
  if (!roadCat) {
    roadCat = await prisma.category.create({
      data: { name: "Roadside Oddities", slug: "roadside-oddities", icon: "🚗" },
    });
  }

  let created = 0;
  let skipped = 0;

  for (const a of attractions) {
    const sourceUrl = a.source_url ?? undefined;
    if (sourceUrl && existingUrls.has(sourceUrl)) {
      skipped++;
      continue;
    }
    const att = await prisma.attraction.create({
      data: {
        name: a.name,
        description: a.description ?? undefined,
        address: a.address ?? undefined,
        city: a.city ?? undefined,
        state: a.state,
        latitude: a.latitude ?? undefined,
        longitude: a.longitude ?? undefined,
        imageUrl: a.image_url ?? undefined,
        sourceUrl: sourceUrl ?? undefined,
      },
    });
    if (att.sourceUrl) existingUrls.add(att.sourceUrl);
    await prisma.attractionCategory.upsert({
      where: {
        attractionId_categoryId: { attractionId: att.id, categoryId: roadCat.id },
      },
      create: { attractionId: att.id, categoryId: roadCat.id },
      update: {},
    });
    created++;
    if (created % 500 === 0) console.log(`  created ${created}...`);
  }

  const totalNow = await prisma.attraction.count();
  console.log(`Created ${created}, skipped ${skipped}. Neon now has ${totalNow} attractions.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
