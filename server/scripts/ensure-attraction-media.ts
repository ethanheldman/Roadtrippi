/**
 * Ensure every attraction has:
 * 1. imageUrl from Roadside America (fetch from sourceUrl, or find sourceUrl from state "all" page then fetch)
 * 2. latitude and longitude (geocode from address/city/state)
 *
 * Run from server: npx tsx scripts/ensure-attraction-media.ts [--limit N] [--state ME]
 * Optional: --images-only or --coords-only to run only one step.
 * Rate-limited for RA (5s) and Nominatim (1.1s).
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";
import { geocodeAttraction } from "../src/lib/geocode.js";

const prisma = new PrismaClient();
const BASE = "https://www.roadsideamerica.com";
const DELAY_RA_MS = 5000;
const STATE_CODES_LOWER: Record<string, string> = {};
"AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY"
  .split(" ")
  .forEach((s) => { STATE_CODES_LOWER[s] = s.toLowerCase(); });

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
  const anyImg = $('img[src*="attract/images"]').first().attr("src");
  if (anyImg && anyImg.trim()) return toAbsoluteUrl(anyImg.trim());
  return null;
}

async function fetchImageFromSourceUrl(sourceUrl: string): Promise<string | null> {
  try {
    const path = sourceUrl.replace(BASE, "").replace(/^\//, "") || "/";
    const res = await client.get("/" + path.replace(/^\/+/, ""));
    const html = typeof res.data === "string" ? res.data : "";
    return extractImageFromHtml(html);
  } catch {
    return null;
  }
}

/** Parse RA state "all" page (HTML): list items with City and links to /story/ or /tip/. Returns { city, name, url }[]. */
function parseStateAllPage(html: string): { city: string; name: string; url: string }[] {
  const out: { city: string; name: string; url: string }[] = [];
  const $ = cheerio.load(html);
  $('a[href*="/story/"], a[href*="/tip/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.includes("/video/")) return;
    const fullUrl = href.startsWith("http") ? href : BASE + (href.startsWith("/") ? href : "/" + href);
    if (!/\.roadsideamerica\.com\/(?:story|tip)\/\d+/.test(fullUrl)) return;
    const name = $(el).text().trim();
    if (!name) return;
    let city = "";
    const li = $(el).closest("li");
    if (li.length) {
      const strong = li.find("strong").first();
      if (strong.length) city = strong.text().replace(/:$/, "").trim();
      if (!city) {
        const text = li.text();
        const beforeName = text.split(name)[0] || "";
        const m = beforeName.match(/([A-Za-z][A-Za-z\s\-']+):\s*$/);
        if (m) city = m[1].trim();
      }
    }
    if (name && fullUrl) out.push({ city, name, url: fullUrl });
  });
  return out;
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/['']/g, "'")
    .trim();
}

async function main() {
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx >= 0 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1], 10) : 0;
  const stateArg = process.argv.indexOf("--state") >= 0 && process.argv[process.argv.indexOf("--state") + 1]
    ? process.argv[process.argv.indexOf("--state") + 1].trim().toUpperCase()
    : null;
  const imagesOnly = process.argv.includes("--images-only");
  const coordsOnly = process.argv.includes("--coords-only");

  const whereState = stateArg ? { state: stateArg } : {};

  // ---- Step 1: Find RA sourceUrl for attractions that have none (by scraping state "all" page) ----
  if (!coordsOnly) {
    const noSource = await prisma.attraction.findMany({
      where: {
        ...whereState,
        OR: [{ sourceUrl: null }, { sourceUrl: "" }],
        state: { not: "US" },
      },
      select: { id: true, name: true, city: true, state: true },
      take: limit > 0 ? limit : undefined,
    });

    if (noSource.length > 0) {
      const byState = new Map<string, typeof noSource>();
      for (const a of noSource) {
        const s = a.state || "";
        if (!byState.has(s)) byState.set(s, []);
        byState.get(s)!.push(a);
      }

      let sourceUrlFound = 0;
      for (const [state, attractions] of byState) {
        const stateCode = STATE_CODES_LOWER[state] ?? state.toLowerCase();
        try {
          const res = await client.get(`/location/${stateCode}/all`);
          const html = typeof res.data === "string" ? res.data : "";
          const raList = parseStateAllPage(html);
          const byKey = new Map<string, { city: string; name: string; url: string }>();
          for (const r of raList) {
            const key = `${normalizeForMatch(r.city)}|${normalizeForMatch(r.name)}`;
            if (!byKey.has(key)) byKey.set(key, r);
          }
          for (const a of attractions) {
            const cityNorm = normalizeForMatch(a.city || "");
            const nameNorm = normalizeForMatch(a.name || "");
            let found = byKey.get(`${cityNorm}|${nameNorm}`);
            if (!found) {
              for (const [, v] of byKey) {
                if (normalizeForMatch(v.name) === nameNorm && (!cityNorm || normalizeForMatch(v.city) === cityNorm)) {
                  found = v;
                  break;
                }
              }
            }
            if (found) {
              await prisma.attraction.update({
                where: { id: a.id },
                data: { sourceUrl: found.url },
              });
              sourceUrlFound++;
              console.log(`  sourceUrl: ${a.name} (${a.city}, ${a.state}) -> ${found.url}`);
            }
          }
          await prisma.$disconnect();
          await delay(DELAY_RA_MS);
        } catch (e) {
          console.warn(`  Failed to fetch /location/${stateCode}/all:`, (e as Error).message);
        }
      }
      console.log(`Step 1 (find sourceUrl): set ${sourceUrlFound} sourceUrls.\n`);
    }
  }

  // ---- Step 2: Backfill imageUrl from Roadside America for those with sourceUrl but no image ----
  if (!coordsOnly) {
    const needImage = await prisma.attraction.findMany({
      where: {
        ...whereState,
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

    console.log(`Step 2 (images): ${needImage.length} attractions with RA sourceUrl but no image.`);
    let imagesSet = 0;
    for (const a of needImage) {
      const url = a.sourceUrl as string;
      const imageUrl = await fetchImageFromSourceUrl(url);
      if (imageUrl) {
        await prisma.attraction.update({ where: { id: a.id }, data: { imageUrl } });
        imagesSet++;
        console.log(`  image: ${a.name} (${a.state})`);
      }
      await prisma.$disconnect();
      await delay(DELAY_RA_MS);
    }
    console.log(`  Updated ${imagesSet} images.\n`);
  }

  // ---- Step 3: Geocode attractions missing latitude or longitude ----
  if (!imagesOnly) {
    const needGeocode = await prisma.attraction.findMany({
      where: {
        ...whereState,
        OR: [{ latitude: null }, { longitude: null }],
      },
      select: { id: true, name: true, address: true, city: true, state: true },
      take: limit > 0 ? limit : undefined,
    });

    console.log(`Step 3 (coords): ${needGeocode.length} attractions missing lat/lng.`);
    let coordsSet = 0;
    for (const a of needGeocode) {
      const result = await geocodeAttraction({
        address: a.address,
        city: a.city,
        state: a.state,
      });
      if (result) {
        await prisma.attraction.update({
          where: { id: a.id },
          data: { latitude: result.lat, longitude: result.lon },
        });
        coordsSet++;
        console.log(`  coords: ${a.name} -> ${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}`);
      }
      await prisma.$disconnect();
    }
    console.log(`  Updated ${coordsSet} coordinates.\n`);
  }

  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
