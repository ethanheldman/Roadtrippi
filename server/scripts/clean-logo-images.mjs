/**
 * Null out attraction images that are actually the RoadsideAmerica site logo
 * (or other non-photo junk). Those render as broken/blank tiles; nulling them
 * makes the app show its branded placeholder and keeps the games from using
 * them. Safe to run repeatedly.
 *
 *   cd server && node scripts/clean-logo-images.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const res = await prisma.attraction.updateMany({
  where: {
    OR: [
      { imageUrl: { contains: "roadside-america-logo" } },
      { imageUrl: { contains: "/images/logo" } },
      { imageUrl: { endsWith: ".svg" } },
    ],
  },
  data: { imageUrl: null },
});
const real = await prisma.attraction.count({ where: { imageUrl: { contains: "/attract/images" } } });
const none = await prisma.attraction.count({ where: { OR: [{ imageUrl: null }, { imageUrl: "" }] } });
console.log(`Nulled ${res.count} logo/junk images. Real photos=${real}, placeholder=${none}.`);
await prisma.$disconnect();
