/**
 * Targeted gap-fix: re-fetch the original RoadsideAmerica page for attractions
 * that are missing location data (state "US", no city, or no coordinates) and
 * fill in the gaps from the source. Reuses the scraper's page parsers.
 *
 * Unlike a full crawl, this only touches pages we ALREADY reference via
 * sourceUrl — many of these are "(Gone)"/"(Closed)" attractions that the
 * state-index crawl no longer links to, so a targeted re-fetch is the only way
 * to recover their location.
 *
 * Never clobbers good data with null: a field is only written when the parsed
 * value is non-empty AND the current value is missing (or the row's state is
 * the placeholder "US").
 *
 *   cd server
 *   npx tsx scripts/backfill-source-data.ts --dry-run --limit 5   # preview
 *   npx tsx scripts/backfill-source-data.ts                       # run all
 */

import { PrismaClient } from "@prisma/client";
import { parseStoryPage, parseTipPage, delay } from "./scrape.js";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const limitIdx = process.argv.indexOf("--limit");
const LIMIT = limitIdx >= 0 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1], 10) : 0;
const DELAY_MS = 4500; // match the scraper's polite rate

type Ref = { type: "story" | "tip"; id: string };
function refFromSource(url: string | null): Ref | null {
  if (!url) return null;
  const s = url.match(/\/story\/(\d+)/);
  if (s) return { type: "story", id: s[1] };
  const t = url.match(/\/tip\/(\d+)/);
  if (t) return { type: "tip", id: t[1] };
  return null;
}

const blank = (v: string | null | undefined) => !v || v.trim() === "";

async function main() {
  const rows = await prisma.attraction.findMany({
    where: {
      AND: [
        { sourceUrl: { not: null } },
        { sourceUrl: { not: "" } },
        { OR: [{ state: "US" }, { city: null }, { city: "" }, { latitude: null }, { longitude: null }] },
      ],
    },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
      description: true,
      address: true,
      imageUrl: true,
      sourceUrl: true,
    },
  });

  let targets = rows.filter((r) => refFromSource(r.sourceUrl));
  if (LIMIT > 0) targets = targets.slice(0, LIMIT);

  console.log(
    `${targets.length} attractions to re-fetch from source${DRY_RUN ? " (DRY RUN)" : ""}.\n`
  );

  let updated = 0,
    failed = 0,
    noChange = 0;

  for (let i = 0; i < targets.length; i++) {
    const a = targets[i];
    const ref = refFromSource(a.sourceUrl)!;
    process.stdout.write(
      `[${i + 1}/${targets.length}] ${ref.type}/${ref.id} ${a.name.slice(0, 36)}… `
    );

    let parsed: Awaited<ReturnType<typeof parseStoryPage>> = null;
    try {
      parsed = ref.type === "story" ? await parseStoryPage(ref.id) : await parseTipPage(ref.id);
    } catch {
      parsed = null;
    }

    if (!parsed) {
      failed++;
      console.log("fail");
      await delay(DELAY_MS);
      continue;
    }

    const data: Record<string, string> = {};
    // Replace the "US" placeholder (or empty) state with the real one.
    if (parsed.state && parsed.state !== "US" && (a.state === "US" || blank(a.state))) {
      data.state = parsed.state;
    }
    if (parsed.city && blank(a.city)) data.city = parsed.city;
    if (parsed.address && blank(a.address)) data.address = parsed.address;
    if (parsed.description && blank(a.description)) data.description = parsed.description;
    if (parsed.imageUrl && blank(a.imageUrl)) data.imageUrl = parsed.imageUrl;

    if (Object.keys(data).length === 0) {
      noChange++;
      console.log("no new data");
      await delay(DELAY_MS);
      continue;
    }

    if (DRY_RUN) {
      console.log("would set " + JSON.stringify(data));
    } else {
      await prisma.attraction.update({ where: { id: a.id }, data });
      updated++;
      console.log("✓ " + Object.keys(data).join(", "));
    }
    await delay(DELAY_MS);
  }

  await prisma.$disconnect();
  console.log(
    `\nDone. ${DRY_RUN ? "Would update" : "Updated"} ${updated}, failed/gone ${failed}, no-change ${noChange}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
