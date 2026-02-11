/**
 * Backfill sourceUrl and imageUrl for New Hampshire attractions from Roadside America.
 * Run scrape first to populate scraped-nh.json:
 *   npx tsx scripts/scrape.ts --state nh
 * Then run this script (from server directory):
 *   npx tsx scripts/backfill-nh-ra-images.ts
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const OUT_DIR = join(process.cwd(), "scripts", "data");
const SCRAPED_NH_PATH = join(OUT_DIR, "scraped-nh.json");

type ScrapedRow = {
  name: string;
  city: string | null;
  state: string;
  description: string | null;
  address: string | null;
  sourceUrl: string;
  imageUrl: string | null;
};

function norm(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).toLowerCase().trim().replace(/\s+/g, " ");
}

function main() {
  if (!existsSync(SCRAPED_NH_PATH)) {
    console.error("scraped-nh.json not found. Run first: npx tsx scripts/scrape.ts --state nh");
    process.exit(1);
  }

  let raw: string;
  try {
    raw = readFileSync(SCRAPED_NH_PATH, "utf-8");
  } catch (e) {
    console.error("Failed to read", SCRAPED_NH_PATH, e);
    process.exit(1);
  }

  let scraped: ScrapedRow[];
  try {
    scraped = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON in scraped-nh.json");
    process.exit(1);
  }

  const nhScraped = scraped.filter((r) => r.state.toUpperCase() === "NH");
  const byKey = new Map<string, ScrapedRow>();
  for (const r of nhScraped) {
    const key = `${norm(r.name)}|${norm(r.city)}`;
    if (!byKey.has(key)) byKey.set(key, r);
  }

  const prisma = new PrismaClient();

  (async () => {
    const dbAttractions = await prisma.attraction.findMany({
      where: { state: "NH" },
      select: { id: true, name: true, city: true, sourceUrl: true, imageUrl: true },
    });

    let updated = 0;
    let skipped = 0;
    for (const att of dbAttractions) {
      const key = `${norm(att.name)}|${norm(att.city)}`;
      const row = byKey.get(key);
      if (!row || !row.sourceUrl) {
        skipped++;
        continue;
      }
      const updates: { sourceUrl: string; imageUrl?: string | null } = { sourceUrl: row.sourceUrl };
      if (row.imageUrl != null && row.imageUrl !== "") updates.imageUrl = row.imageUrl;

      await prisma.attraction.update({
        where: { id: att.id },
        data: updates,
      });
      updated++;
      console.log(`  ${att.name} (${att.city}) -> ${row.sourceUrl}`);
    }

    console.log(`\nUpdated ${updated} NH attractions with Roadside America sourceUrl/imageUrl; skipped ${skipped} (no match).`);
    await prisma.$disconnect();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
