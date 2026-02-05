/**
 * Backfill imageUrl for attractions that have none, by fetching Roadside America
 * story/tip pages and extracting og:image or first content image.
 * Rate-limited to be respectful. Run: npx tsx server/scripts/backfill-attraction-images.ts [--limit N]
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "https://www.roadsideamerica.com";
const DELAY_MS = 5000;

const client = axios.create({
  baseURL: BASE,
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; Roadtrippi/1.0; +https://github.com/roadtrippi)",
    Accept: "text/html,application/xhtml+xml",
  },
});

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function toAbsoluteUrl(url: string): string {
  if (url.startsWith("http")) return url;
  const base = BASE.replace(/\/$/, "");
  return url.startsWith("/") ? base + url : base + "/" + url;
}

function extractImageFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && ogImage.trim()) return toAbsoluteUrl(ogImage.trim());
  const img = $("article img, .content img, main img, .story-content img").first().attr("src");
  if (img && img.trim()) return toAbsoluteUrl(img.trim());
  // Fallback: first img in body that looks like a content image (attract/images)
  const anyImg = $('img[src*="attract/images"]').first().attr("src");
  if (anyImg && anyImg.trim()) return toAbsoluteUrl(anyImg.trim());
  return null;
}

async function fetchImageUrl(sourceUrl: string): Promise<string | null> {
  try {
    const path = sourceUrl.replace(BASE, "").replace(/^\//, "") || "/";
    const res = await client.get("/" + path.replace(/^\/+/, ""));
    const html = typeof res.data === "string" ? res.data : "";
    return extractImageFromHtml(html);
  } catch {
    return null;
  }
}

async function main() {
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx >= 0 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1], 10) : 0;

  const tipMatch = /roadsideamerica\.com\/tip\/(\d+)/i;
  const storyMatch = /roadsideamerica\.com\/story\/(\d+)/i;

  const missing = await prisma.attraction.findMany({
    where: {
      OR: [{ imageUrl: null }, { imageUrl: "" }],
      sourceUrl: { not: null },
      AND: [
        {
          OR: [
            { sourceUrl: { contains: "roadsideamerica.com/tip/", mode: "insensitive" } },
            { sourceUrl: { contains: "roadsideamerica.com/story/", mode: "insensitive" } },
          ],
        },
      ],
    },
    select: { id: true, name: true, state: true, sourceUrl: true },
    take: limit > 0 ? limit : undefined,
  });

  console.log(`Found ${missing.length} attractions with no image and a Roadside America sourceUrl.`);

  let updated = 0;
  for (const a of missing) {
    const url = a.sourceUrl as string;
    if (!url || (!tipMatch.test(url) && !storyMatch.test(url))) continue;

    const imageUrl = await fetchImageUrl(url);
    if (imageUrl) {
      await prisma.attraction.update({
        where: { id: a.id },
        data: { imageUrl },
      });
      updated++;
      console.log(`  [${updated}] ${a.name} (${a.state}) -> image set`);
    }
    await delay(DELAY_MS);
  }

  await prisma.$disconnect();
  console.log(`Done. Updated ${updated} attractions.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
