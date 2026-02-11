/**
 * Geocode attractions that have no lat/lng using OpenStreetMap Nominatim.
 * Usage (from server directory):
 *   npx tsx scripts/geocode-attractions.ts              # all states
 *   STATE=CA npx tsx scripts/geocode-attractions.ts     # California only
 *   STATE=CA CITY="San Diego" npx tsx scripts/geocode-attractions.ts  # San Diego, CA only
 * From repo root: npm run geocode:ca  or  npm run geocode:sandiego
 * Respects 1 req/sec Nominatim usage policy.
 */

import { PrismaClient } from "@prisma/client";
import { geocodeAttraction } from "../src/lib/geocode.js";

const prisma = new PrismaClient();

async function main() {
  const stateEnv = process.env.STATE?.trim().toUpperCase();
  const cityEnv = process.env.CITY?.trim();
  const states = stateEnv
    ? stateEnv.split(",").map((s) => s.trim()).filter(Boolean)
    : null;
  const where: {
    OR: ({ latitude: null } | { longitude: null })[];
    state?: string | { in: string[] };
    city?: string | { equals: string; mode: "insensitive" };
  } = {
    OR: [{ latitude: null }, { longitude: null }],
  };
  if (cityEnv) {
    where.city = { contains: cityEnv, mode: "insensitive" };
    console.log(`Filtering to city containing: ${cityEnv}`);
  }
  if (states?.length === 1) {
    const s = states[0];
    if (s === "CA") {
      where.state = { in: ["CA", "California"] };
      console.log(`Filtering to state: CA (and "California")`);
    } else if (s === "ME") {
      where.state = { in: ["ME", "Maine"] };
      console.log(`Filtering to state: ME (and "Maine")`);
    } else if (s === "TX") {
      where.state = { in: ["TX", "Texas"] };
      console.log(`Filtering to state: TX (and "Texas")`);
    } else if (s === "NY") {
      where.state = { in: ["NY", "New York"] };
      console.log(`Filtering to state: NY (and "New York")`);
    } else if (s === "MO") {
      where.state = { in: ["MO", "Missouri"] };
      console.log(`Filtering to state: MO (and "Missouri")`);
    } else if (s === "MD") {
      where.state = { in: ["MD", "Maryland"] };
      console.log(`Filtering to state: MD (and "Maryland")`);
    } else {
      where.state = s;
      console.log(`Filtering to state: ${s}`);
    }
  } else if (states && states.length > 1) {
    where.state = { in: states };
    console.log(`Filtering to states: ${states.join(", ")}`);
  }

  const needGeocode = await prisma.attraction.findMany({
    where,
    select: { id: true, name: true, address: true, city: true, state: true },
  });
  if (needGeocode.length === 0) {
    console.log("No attractions missing coordinates.");
    await prisma.$disconnect();
    return;
  }

  if (process.env.LIST === "1" || process.env.LIST === "true") {
    console.log(`${needGeocode.length} attractions missing coordinates (LIST mode, not geocoding):`);
    needGeocode.forEach((a) => console.log(`  - ${a.name} (${a.city}, ${a.state})`));
    await prisma.$disconnect();
    return;
  }

  console.log(`${needGeocode.length} attractions missing coordinates.`);

  let updated = 0;
  let failed = 0;

  for (const a of needGeocode) {
    const result = await geocodeAttraction({
      address: a.address,
      city: a.city,
      state: a.state,
      name: a.name,
    });

    if (result) {
      await prisma.attraction.update({
        where: { id: a.id },
        data: { latitude: result.lat, longitude: result.lon },
      });
      updated++;
      console.log(`  OK: ${a.name} -> ${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}`);
    } else {
      failed++;
      console.log(`  Fail: ${a.name}`);
    }
  }

  await prisma.$disconnect();
  console.log(`Done. Updated: ${updated}, failed/skipped: ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
