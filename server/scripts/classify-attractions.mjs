import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
function classify(name, desc) {
  const n = (name || "").toLowerCase();
  const s = (n + " " + (desc || "").toLowerCase());
  if (/\bmuffler m(?:an|en)\b/.test(n)) return "Muffler Man";
  if (/world'?s (?:largest|biggest|tallest|longest)\b/.test(n)) return "World's Largest";
  if (/\b(mystery spot|mystery hill|gravity hill|gravity road|spook hill|the vortex|oregon vortex|mystery shack)\b/.test(s)) return "Mystery Spots";
  if (/\b(museum|hall of fame)\b/.test(n)) return "Museums";
  if (/\bstatues?\b/.test(n)) return "Statues";
  if (/\b(giant|colossal|enormous|gigantic|mammoth|jumbo|huge)\b/.test(n)) return "Big Things";
  return "Roadside Oddities";
}
const cats = await prisma.category.findMany({ select: { id: true, name: true } });
const byName = new Map(cats.map((c) => [c.name, c.id]));
const rows = await prisma.attraction.findMany({ select: { id: true, name: true, description: true } });
const pairs = [];
for (const a of rows) { const cid = byName.get(classify(a.name, a.description)); if (cid) pairs.push({ attractionId: a.id, categoryId: cid }); }
await prisma.$executeRawUnsafe(`DELETE FROM attraction_categories`);
for (let i = 0; i < pairs.length; i += 5000) await prisma.attractionCategory.createMany({ data: pairs.slice(i, i + 5000), skipDuplicates: true });
console.log(`Reassigned ${pairs.length} attractions to one correct type.`);
await prisma.$disconnect();
