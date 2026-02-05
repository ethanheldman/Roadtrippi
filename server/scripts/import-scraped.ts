/**
 * Import scraped.json into the database.
 * Geocodes each new/updated attraction so it appears on the map as it's added.
 * Usage: npm run import-scraped  (from server directory)
 */

import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { geocodeAttraction } from "../src/lib/geocode.js";

const OUT_DIR = join(process.cwd(), "scripts", "data");
const SCRAPED_PATH = join(OUT_DIR, "scraped.json");

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
    console.error("scraped.json not found at", SCRAPED_PATH);
    process.exit(1);
  }

  let data: ScrapedRow[];
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON in scraped.json");
    process.exit(1);
  }

  if (!Array.isArray(data) || data.length === 0) {
    console.log("No entries in scraped.json.");
    process.exit(0);
  }

  const prisma = new PrismaClient();

  const slug = "roadside-oddities";
  let cat = await prisma.category.findFirst({ where: { slug } });
  if (!cat) {
    cat = await prisma.category.create({
      data: { name: "Roadside Oddities", slug, icon: "🚗" },
    });
  }

  const skipGeocode = process.env.SKIP_GEOCODE === "1" || process.env.SKIP_GEOCODE === "true";
  if (skipGeocode) console.log("SKIP_GEOCODE=1: importing only, no geocoding.");
  console.log(`Importing ${data.length} attractions from scraped.json...`);
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

    // Match by sourceUrl first, then by name+state (so we update seed-created records that have no sourceUrl)
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
      if (!skipGeocode) {
        const coords = await geocodeAttraction({ address: a.address, city, state });
        if (coords) {
          await prisma.attraction.update({
            where: { id: att.id },
            data: { latitude: coords.lat, longitude: coords.lon },
          });
        }
      }
    } else {
      // Don't overwrite existing image with null (preserve seed/manual images)
      await prisma.attraction.update({
        where: { id: att.id },
        data: {
          name: a.name,
          city,
          state,
          description: a.description,
          address: a.address,
          sourceUrl: a.sourceUrl,
          ...(a.imageUrl != null && { imageUrl: a.imageUrl }),
        },
      });
      updated++;
      if (!skipGeocode && (att.latitude == null || att.longitude == null)) {
        const coords = await geocodeAttraction({
          address: a.address,
          city,
          state,
        });
        if (coords) {
          await prisma.attraction.update({
            where: { id: att.id },
            data: { latitude: coords.lat, longitude: coords.lon },
          });
        }
      }
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
  console.log(`Done. Created: ${created}, updated: ${updated}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
