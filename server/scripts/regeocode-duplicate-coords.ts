/**
 * Re-geocode attractions that share the exact same coordinates (stacked on the map).
 * Uses name+city+state first so each attraction gets distinct coordinates.
 * Usage (from server directory):
 *   npx tsx scripts/regeocode-duplicate-coords.ts     # all states
 *   STATE=CA npx tsx scripts/regeocode-duplicate-coords.ts
 * Respects 1 req/sec Nominatim usage policy.
 */

import { PrismaClient } from "@prisma/client";
import { geocodeAttraction } from "../src/lib/geocode.js";

const prisma = new PrismaClient();

function round4(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

async function main() {
  const stateEnv = process.env.STATE?.trim().toUpperCase();
  const where: { latitude: { not: null }; longitude: { not: null }; state?: string | { in: string[] } } = {
    latitude: { not: null },
    longitude: { not: null },
  };
  if (stateEnv === "CA") {
    where.state = { in: ["CA", "California"] };
    console.log("Filtering to state: CA (and \"California\")");
  } else if (stateEnv === "ME") {
    where.state = { in: ["ME", "Maine"] };
    console.log("Filtering to state: ME (and \"Maine\")");
  } else if (stateEnv === "TX") {
    where.state = { in: ["TX", "Texas"] };
    console.log("Filtering to state: TX (and \"Texas\")");
  } else if (stateEnv) {
    where.state = stateEnv;
    console.log(`Filtering to state: ${stateEnv}`);
  }

  const all = await prisma.attraction.findMany({
    where,
    select: { id: true, name: true, address: true, city: true, state: true, latitude: true, longitude: true },
  });

  const key = (a: { latitude: number; longitude: number }) =>
    `${round4(a.latitude)},${round4(a.longitude)}`;
  const byCoord = new Map<string, typeof all>();
  for (const a of all) {
    const k = key(a as { latitude: number; longitude: number });
    if (!byCoord.has(k)) byCoord.set(k, []);
    byCoord.get(k)!.push(a);
  }

  const toRegeocode: (typeof all)[0][] = [];
  for (const group of byCoord.values()) {
    if (group.length > 1) {
      toRegeocode.push(...group);
    }
  }

  if (toRegeocode.length === 0) {
    console.log("No duplicate coordinates found.");
    await prisma.$disconnect();
    return;
  }

  console.log(`${toRegeocode.length} attractions share coordinates with others; re-geocoding (name-first for exact locations).`);

  let updated = 0;
  let failed = 0;
  for (const a of toRegeocode) {
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
  console.log(`Done. Updated: ${updated}, failed: ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
