/**
 * Fix attractions that have no image or a broken/local image:
 * - Use public image URLs (Wikipedia Commons, etc.) so cards always show a picture.
 * - For name+state matches, update all records (no duplicate deletion here).
 * Run: npx tsx server/scripts/fix-attraction-images.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Public URLs so images load everywhere (no dependency on /uploads/ or same-origin).
const IMAGE_OVERRIDES: { name: string; state: string; imageUrl: string }[] = [
  { name: "Fremont Troll", state: "WA", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Fremont_randoms_-_Flickr_-_eliduke.jpg/800px-Fremont_randoms_-_Flickr_-_eliduke.jpg" },
  { name: "Cabazon Dinosaurs", state: "CA", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Cabazon-Dinosaurs-2.jpg/800px-Cabazon-Dinosaurs-2.jpg" },
  { name: "Giant Lobster", state: "ME", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Giant_Lobster_Boothbay_ME.jpg/800px-Giant_Lobster_Boothbay_ME.jpg" },
  { name: "Big Betsy, Giant Lobster", state: "ME", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Giant_Lobster_Boothbay_ME.jpg/800px-Giant_Lobster_Boothbay_ME.jpg" },
  { name: "Big Betsy, Giant Lobster", state: "FL", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Giant_Lobster_Boothbay_ME.jpg/800px-Giant_Lobster_Boothbay_ME.jpg" },
  { name: "Trolls: Guardians of the Seeds", state: "ME", imageUrl: "https://www.thomasdambo.com/data/asset/73c2zy/w1200/65cc86647bba9dee34679c98_076_2021_roskva_guardians-of-the-seeds_web.jpg" },
];

async function main() {
  for (const { name, state, imageUrl } of IMAGE_OVERRIDES) {
    const updated = await prisma.attraction.updateMany({
      where: { name, state },
      data: { imageUrl },
    });
    if (updated.count > 0) console.log(`Set image for ${name}, ${state} (${updated.count} record(s)).`);
  }
  // Also fix any attraction still using local /uploads/ for Fremont Troll (so production works)
  const fremontLocal = await prisma.attraction.updateMany({
    where: { name: "Fremont Troll", state: "WA", imageUrl: "/uploads/attractions/fremont-troll.jpg" },
    data: { imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Fremont_randoms_-_Flickr_-_eliduke.jpg/800px-Fremont_randoms_-_Flickr_-_eliduke.jpg" },
  });
  if (fremontLocal.count > 0) console.log("Updated Fremont Troll from local path to public URL.");
  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
