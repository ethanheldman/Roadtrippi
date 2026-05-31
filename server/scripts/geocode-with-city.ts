/**
 * Geocode ONLY attractions that have a real city + state (precise, trustworthy
 * coordinates). Deliberately skips city-less rows so we don't litter the map
 * with fake state-centroid pins for defunct attractions.
 *
 *   cd server && npx tsx scripts/geocode-with-city.ts
 */
import { PrismaClient } from "@prisma/client";
import { geocodeAttraction } from "../src/lib/geocode.js";

const prisma = new PrismaClient();

const rows = await prisma.attraction.findMany({
  where: {
    AND: [
      { OR: [{ latitude: null }, { longitude: null }] },
      { city: { not: null } },
      { city: { not: "" } },
      { NOT: { state: "US" } },
    ],
  },
  select: { id: true, name: true, address: true, city: true, state: true },
});

console.log(`${rows.length} attractions with a city to geocode.\n`);
let ok = 0,
  fail = 0;
for (const a of rows) {
  const r = await geocodeAttraction({ address: a.address, city: a.city, state: a.state, name: a.name });
  if (r) {
    await prisma.attraction.update({ where: { id: a.id }, data: { latitude: r.lat, longitude: r.lon } });
    ok++;
    console.log(`  OK   ${a.name} (${a.city}, ${a.state}) -> ${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}`);
  } else {
    fail++;
    console.log(`  Fail ${a.name} (${a.city}, ${a.state})`);
  }
}
await prisma.$disconnect();
console.log(`\nDone. Updated ${ok}, failed ${fail}.`);
