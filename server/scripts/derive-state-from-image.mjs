/**
 * Fix attractions stuck with the placeholder state "US" by reading the real
 * 2-letter state code out of their RoadsideAmerica image URL path
 * (e.g. .../attract/images/ny/NYWAT... -> NY). No network calls.
 *
 *   cd server
 *   node scripts/derive-state-from-image.mjs --dry-run
 *   node scripts/derive-state-from-image.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const RE = /\/attract\/images(?:-icon)?\/([a-z]{2})\//i;
const VALID = new Set([
  "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in","ia","ks","ky","la",
  "me","md","ma","mi","mn","ms","mo","mt","ne","nv","nh","nj","nm","ny","nc","nd","oh","ok",
  "or","pa","ri","sc","sd","tn","tx","ut","vt","va","wa","wv","wi","wy",
]);

const rows = await prisma.attraction.findMany({
  where: { state: "US" },
  select: { id: true, name: true, imageUrl: true },
});

let updated = 0;
const skipped = [];
for (const a of rows) {
  const m = (a.imageUrl || "").match(RE);
  const code = m && VALID.has(m[1].toLowerCase()) ? m[1].toUpperCase() : null;
  if (!code) {
    skipped.push(a.name);
    continue;
  }
  if (DRY_RUN) {
    console.log(`  would set ${code}: ${a.name}`);
  } else {
    await prisma.attraction.update({ where: { id: a.id }, data: { state: code } });
  }
  updated++;
}

await prisma.$disconnect();
console.log(
  `\n${DRY_RUN ? "Would update" : "Updated"} ${updated} rows. Skipped ${skipped.length} (no state in image path).`
);
if (skipped.length) console.log("Skipped:", JSON.stringify(skipped));
