/**
 * Import scraped-muffler-man.json into the database with the Muffler Man category.
 * Run after: npm run scrape:muffler-man  (from server directory)
 * Usage: npm run import-muffler-man
 */

import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const OUT_DIR = join(process.cwd(), "scripts", "data");
const SCRAPED_PATH = join(OUT_DIR, "scraped-muffler-man.json");

type ScrapedRow = {
  name: string;
  city: string | null;
  state: string;
  description: string | null;
  address: string | null;
  sourceUrl: string;
  imageUrl: string | null;
};

function parseCityStateFromAddress(address: string | null): { city: string | null; state: string | null } {
  if (!address || typeof address !== "string") return { city: null, state: null };
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 1; i--) {
    const part = parts[i].replace(/Directions.*$/i, "").trim();
    if (/^[A-Z]{2}$/i.test(part)) {
      return { city: parts[i - 1] || null, state: part.toUpperCase() };
    }
  }
  return { city: null, state: null };
}

async function main() {
  let raw: string;
  try {
    raw = readFileSync(SCRAPED_PATH, "utf-8");
  } catch (e) {
    console.error("scraped-muffler-man.json not found at", SCRAPED_PATH);
    console.error("Run: npm run scrape:muffler-man  first.");
    process.exit(1);
  }

  let data: ScrapedRow[];
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON in scraped-muffler-man.json");
    process.exit(1);
  }

  if (!Array.isArray(data) || data.length === 0) {
    console.log("No entries in scraped-muffler-man.json.");
    process.exit(0);
  }

  const prisma = new PrismaClient();

  const slug = "muffler-man";
  let cat = await prisma.category.findFirst({ where: { slug } });
  if (!cat) {
    cat = await prisma.category.create({
      data: { name: "Muffler Man", slug, icon: "🦺" },
    });
  }

  console.log(`Importing ${data.length} Muffler Men from scraped-muffler-man.json...`);
  let created = 0;
  let updated = 0;

  for (const a of data) {
    let city = a.city;
    let state = a.state;
    if ((!city || state === "US") && a.address) {
      const parsed = parseCityStateFromAddress(a.address);
      if (parsed.city) city = parsed.city;
      if (parsed.state) state = parsed.state;
    }

    let att = await prisma.attraction.findFirst({ where: { sourceUrl: a.sourceUrl } });
    if (!att) {
      att = await prisma.attraction.findFirst({
        where: { name: a.name, state },
      });
    }
    if (!att) {
      att = await prisma.attraction.create({
        data: {
          name: a.name,
          city,
          state,
          description: a.description,
          address: a.address,
          sourceUrl: a.sourceUrl,
          imageUrl: a.imageUrl,
        },
      });
      created++;
    } else {
      await prisma.attraction.update({
        where: { id: att.id },
        data: {
          name: a.name,
          city,
          state,
          description: a.description,
          address: a.address,
          sourceUrl: a.sourceUrl,
          imageUrl: a.imageUrl,
        },
      });
      updated++;
    }
    await prisma.attractionCategory.upsert({
      where: {
        attractionId_categoryId: { attractionId: att.id, categoryId: cat.id },
      },
      create: { attractionId: att.id, categoryId: cat.id },
      update: {},
    });
  }

  await prisma.$disconnect();
  console.log(`Done. Created: ${created}, updated: ${updated}. All tagged as Muffler Man.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
