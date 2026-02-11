/**
 * List attractions by state (and optional city) with geocode status.
 * Usage (from server directory):
 *   STATE=CA npx tsx scripts/list-attractions-by-place.ts
 *   STATE=CA CITY="San Diego" npx tsx scripts/list-attractions-by-place.ts
 * Helps find attractions missing coordinates so you can run geocode-attractions.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const stateEnv = process.env.STATE?.trim().toUpperCase();
  const cityEnv = process.env.CITY?.trim();
  if (!stateEnv) {
    console.log("Usage: STATE=CA [CITY=\"San Diego\"] npx tsx scripts/list-attractions-by-place.ts");
    await prisma.$disconnect();
    return;
  }

  const stateWhere = stateEnv === "CA"
    ? { in: ["CA", "California"] as string[] }
    : stateEnv === "ME"
      ? { in: ["ME", "Maine"] as string[] }
      : stateEnv === "TX"
        ? { in: ["TX", "Texas"] as string[] }
        : stateEnv;

  const where: { state: string | { in: string[] }; city?: { contains: string; mode: "insensitive" } } = {
    state: stateWhere as { in: string[] },
  };
  if (cityEnv) {
    where.city = { contains: cityEnv, mode: "insensitive" };
  }

  const attractions = await prisma.attraction.findMany({
    where,
    select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  const withCoords = attractions.filter((a) => a.latitude != null && a.longitude != null);
  const missingCoords = attractions.filter((a) => a.latitude == null || a.longitude == null);

  console.log(
    `State: ${stateEnv}${cityEnv ? `, city containing: ${cityEnv}` : ""} — ${attractions.length} total, ${withCoords.length} with coordinates, ${missingCoords.length} missing`
  );
  if (missingCoords.length > 0) {
    console.log("\nMissing coordinates:");
    missingCoords.forEach((a) => console.log(`  - ${a.name} (${a.city}, ${a.state})`));
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
