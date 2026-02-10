/**
 * Import New York roadside attractions from Roadside America list.
 * Data in scripts/data/new-york-ra.txt, one "City: Name" per line.
 * Run from server: npx tsx scripts/import-new-york-attractions.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const STATE = "NY";

function parseList(raw: string): { city: string; name: string }[] {
  return raw
    .trim()
    .split("\n")
    .map((line) => {
      const idx = line.indexOf(": ");
      if (idx < 0) return null;
      return {
        city: line.slice(0, idx).trim(),
        name: line.slice(idx + 2).trim(),
      };
    })
    .filter(
      (x): x is { city: string; name: string } =>
        !!x && !!x.city && !!x.name
    );
}

async function main() {
  const dataPath = join(process.cwd(), "scripts", "data", "new-york-ra.txt");
  const raw = readFileSync(dataPath, "utf-8");
  const entries = parseList(raw);

  const prisma = new PrismaClient();

  const oddities = await prisma.category.findFirst({
    where: { slug: "roadside-oddities" },
  });
  const bigThings = await prisma.category.findFirst({
    where: { slug: "big-things" },
  });
  const catId = oddities?.id ?? bigThings?.id ?? null;

  let created = 0;
  let skipped = 0;

  for (const { city, name } of entries) {
    const existing = await prisma.attraction.findFirst({
      where: { name, state: STATE, city },
    });
    if (existing) {
      skipped++;
      continue;
    }
    const att = await prisma.attraction.create({
      data: {
        name,
        city,
        state: STATE,
        description: `New York roadside attraction in ${city}.`,
      },
    });
    if (catId) {
      await prisma.attractionCategory.create({
        data: { attractionId: att.id, categoryId: catId },
      }).catch(() => {});
    }
    created++;
  }

  console.log(
    `New York attractions: created ${created}, skipped (already exist) ${skipped}.`
  );
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
