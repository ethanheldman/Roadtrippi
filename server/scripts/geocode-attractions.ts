/**
 * Geocode attractions that have no lat/lng using OpenStreetMap Nominatim.
 * Usage: npx tsx scripts/geocode-attractions.ts  (from server directory)
 * Respects 1 req/sec Nominatim usage policy.
 */

import { PrismaClient } from "@prisma/client";
import { geocodeAttraction } from "../src/lib/geocode.js";

const prisma = new PrismaClient();

async function main() {
  const stateEnv = process.env.STATE?.trim().toUpperCase();
  const states = stateEnv
    ? stateEnv.split(",").map((s) => s.trim()).filter(Boolean)
    : null;
  const where: {
    OR: ({ latitude: null } | { longitude: null })[];
    state?: string | { in: string[] };
  } = {
    OR: [{ latitude: null }, { longitude: null }],
  };
  if (states?.length === 1) {
    where.state = states[0];
    console.log(`Filtering to state: ${states[0]}`);
  } else if (states && states.length > 1) {
    where.state = { in: states };
    console.log(`Filtering to states: ${states.join(", ")}`);
  }

  const needGeocode = await prisma.attraction.findMany({
    where,
    select: { id: true, name: true, address: true, city: true, state: true },
  });

  console.log(`${needGeocode.length} attractions missing coordinates.`);

  let updated = 0;
  let failed = 0;

  for (const a of needGeocode) {
    const result = await geocodeAttraction({
      address: a.address,
      city: a.city,
      state: a.state,
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
