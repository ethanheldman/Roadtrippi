/**
 * RoadsideAmerica.com scraper — fetches attraction data from all state pages.
 * Rate-limited and respectful. Check site ToS before running at scale.
 * Usage: npm run scrape [-- --db]  (--db to import into database after scraping)
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const BASE = "https://www.roadsideamerica.com";
const DELAY_MS = 4500; // ~4.5s between requests
const OUT_DIR = join(process.cwd(), "scripts", "data");

const STATE_CODES: string[] = [
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga",
  "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md",
  "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj",
  "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc",
  "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy",
];

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

function stateNameToCode(name: string): string {
  const n = name.replace(/\s+/g, " ").trim().toLowerCase();
  return STATE_NAME_TO_CODE[n] ?? name.slice(0, 2).toUpperCase();
}

const client = axios.create({
  baseURL: BASE,
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Referer: `${BASE}/`,
  },
});

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(path: string): Promise<string> {
  const res = await client.get(path);
  return res.data as string;
}

function extractStoryAndTipIds($: ReturnType<typeof cheerio.load>): { storyIds: Set<string>; tipIds: Set<string> } {
  const storyIds = new Set<string>();
  const tipIds = new Set<string>();
  $('a[href*="/story/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const m = href.match(/\/story\/(\d+)/);
    if (m) storyIds.add(m[1]);
  });
  $('a[href*="/tip/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const m = href.match(/\/tip\/(\d+)/);
    if (m) tipIds.add(m[1]);
  });
  return { storyIds, tipIds };
}

/** Extract every /story/ and /tip/ ID from raw HTML (catches links cheerio might miss). */
function extractStoryAndTipIdsFromRaw(html: string): { storyIds: Set<string>; tipIds: Set<string> } {
  const storyIds = new Set<string>();
  const tipIds = new Set<string>();
  const storyRe = /\/story\/(\d+)/g;
  const tipRe = /\/tip\/(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = storyRe.exec(html)) !== null) storyIds.add(m[1]);
  while ((m = tipRe.exec(html)) !== null) tipIds.add(m[1]);
  return { storyIds, tipIds };
}

/** Extract /location/XX/slug links from raw HTML (for city subpage discovery from "all" page). */
function extractStateCitySlugsFromRaw(html: string, stateCode: string): string[] {
  const slugs = new Set<string>();
  const re = new RegExp(`/location/${stateCode}/([a-z0-9-]+)(?:["'\\s?#]|$)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1] !== "all") slugs.add(m[1]);
  }
  return Array.from(slugs);
}

/** Slugify city name for URL: lowercase, spaces to hyphens, remove apostrophes. */
function cityToSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/'/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

/** Extract city names from "all" page list format (e.g. **City:** or <strong>City:</strong>). */
function extractCityNamesFromAllPage(html: string): string[] {
  const names = new Set<string>();
  // Match **CityName:** or <strong>CityName:</strong> (one word or "Two Words")
  const re = /\*\*([^*]+?):\*\*|<strong>([^<]+?):<\/strong>/g;
  let m: RegExpExecArray | null;
  const skip = /^(Texas|State|Skip|Home|Maps|Tips?|Blog|My|Video|Mobile|About|Contact|Submit|Privacy|Terms|Credits|Copyright|Create|Try|Roadside|Attraction|Filter|The|Major|Worth|Mildly|Unrated|Close|Fit|Map|Go|More|Navigation|Miscellaneous)$/i;
  while ((m = re.exec(html)) !== null) {
    const name = (m[1] ?? m[2] ?? "").trim();
    if (name.length >= 2 && name.length < 40 && !skip.test(name) && !/^\d+$/.test(name)) {
      names.add(name);
    }
  }
  return Array.from(names);
}

/** Extract /location/XX/city-slug links from a state page (for subpage discovery). */
function extractStateCityPaths($: ReturnType<typeof cheerio.load>, stateCode: string): string[] {
  const paths = new Set<string>();
  const re = new RegExp(`/location/${stateCode}/([a-z0-9-]+)(?:[?#]|$)`);
  $('a[href*="/location/' + stateCode + '/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const m = href.match(re);
    if (m && m[1] !== "all") paths.add(m[1]);
  });
  return Array.from(paths);
}

/** Load known Texas city names from data file (so we don't rely only on /all page). */
function getKnownTxCitySlugs(): string[] {
  const path = join(OUT_DIR, "tx-cities.json");
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf-8");
    const names: unknown = JSON.parse(raw);
    if (!Array.isArray(names)) return [];
    return names.map((n) => (typeof n === "string" ? cityToSlug(n) : "")).filter(Boolean);
  } catch {
    return [];
  }
}

/** Extract all /story/ and /tip/ IDs from a state. Fetches /location/XX/all (with raw regex), main page, and all city subpages for full list. */
async function getStateIds(stateCode: string): Promise<{ storyIds: Set<string>; tipIds: Set<string> }> {
  const storyIds = new Set<string>();
  const tipIds = new Set<string>();
  try {
    const allHtml = await fetchHtml(`/location/${stateCode}/all`);
    const $all = cheerio.load(allHtml);
    const fromAll = extractStoryAndTipIds($all);
    fromAll.storyIds.forEach((id) => storyIds.add(id));
    fromAll.tipIds.forEach((id) => tipIds.add(id));
    const fromRaw = extractStoryAndTipIdsFromRaw(allHtml);
    fromRaw.storyIds.forEach((id) => storyIds.add(id));
    fromRaw.tipIds.forEach((id) => tipIds.add(id));
    const mainHtml = await fetchHtml(`/location/${stateCode}`);
    const $main = cheerio.load(mainHtml);
    if (storyIds.size === 0 && tipIds.size === 0) {
      const fromMain = extractStoryAndTipIds($main);
      fromMain.storyIds.forEach((id) => storyIds.add(id));
      fromMain.tipIds.forEach((id) => tipIds.add(id));
    }
    const fromMainRaw = extractStoryAndTipIdsFromRaw(mainHtml);
    fromMainRaw.storyIds.forEach((id) => storyIds.add(id));
    fromMainRaw.tipIds.forEach((id) => tipIds.add(id));
    const citySlugsFromMain = extractStateCityPaths($main, stateCode);
    const citySlugsFromAll = extractStateCitySlugsFromRaw(allHtml, stateCode);
    const cityNamesFromList = extractCityNamesFromAllPage(allHtml);
    const citySlugsFromNames = cityNamesFromList.map(cityToSlug).filter((s) => s.length > 0);
    const knownTxSlugs = stateCode.toLowerCase() === "tx" ? getKnownTxCitySlugs() : [];
    const allCitySlugs = [...new Set([...citySlugsFromMain, ...citySlugsFromAll, ...citySlugsFromNames, ...knownTxSlugs])];
    if (allCitySlugs.length > 0) {
      console.log(`Fetching ${allCitySlugs.length} city subpages for full list...`);
    }
    for (const slug of allCitySlugs) {
      await delay(Math.min(DELAY_MS, 800));
      try {
        const cityHtml = await fetchHtml(`/location/${stateCode}/${slug}`);
        const $city = cheerio.load(cityHtml);
        const fromCity = extractStoryAndTipIds($city);
        fromCity.storyIds.forEach((id) => storyIds.add(id));
        fromCity.tipIds.forEach((id) => tipIds.add(id));
        const fromCityRaw = extractStoryAndTipIdsFromRaw(cityHtml);
        fromCityRaw.storyIds.forEach((id) => storyIds.add(id));
        fromCityRaw.tipIds.forEach((id) => tipIds.add(id));
      } catch {
        // ignore single city fetch failure
      }
    }
  } catch (e) {
    console.warn(`Failed to fetch state ${stateCode}:`, (e as Error).message);
  }
  return { storyIds, tipIds };
}

const MUFFLER_MAN_HUB = "/story/37422";

/** Extract all /story/ and /tip/ IDs from the Muffler Men hub page */
async function getMufflerManIds(): Promise<{ storyIds: string[]; tipIds: string[] }> {
  const storyIds = new Set<string>();
  const tipIds = new Set<string>();
  try {
    const html = await fetchHtml(MUFFLER_MAN_HUB);
    const $ = cheerio.load(html);
    $('a[href*="/story/"]').each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const m = href.match(/\/story\/(\d+)/);
      if (m) storyIds.add(m[1]);
    });
    $('a[href*="/tip/"]').each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const m = href.match(/\/tip\/(\d+)/);
      if (m) tipIds.add(m[1]);
    });
    // Don't include the hub page itself
    storyIds.delete("37422");
  } catch (e) {
    console.warn("Failed to fetch Muffler Men hub:", (e as Error).message);
  }
  return {
    storyIds: Array.from(storyIds),
    tipIds: Array.from(tipIds),
  };
}

/** Parse one tip page (e.g. /tip/5889) into same shape as story */
async function parseTipPage(tipId: string): Promise<{
  name: string;
  city: string | null;
  state: string;
  description: string | null;
  address: string | null;
  sourceUrl: string;
  imageUrl: string | null;
} | null> {
  try {
    const html = await fetchHtml(`/tip/${tipId}`);
    const $ = cheerio.load(html);
    const titleText = $("h1").first().text().trim();
    if (!titleText) return null;
    // "Los Angeles, California: Muffler Man - Sergio" -> name after colon, city/state before
    let name = titleText;
    let city: string | null = null;
    let state = "US";
    const colonIdx = titleText.indexOf(":");
    if (colonIdx > 0) {
      name = titleText.slice(colonIdx + 1).trim();
      const locationPart = titleText.slice(0, colonIdx).trim();
      const parts = locationPart.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        city = parts[0];
        state = stateNameToCode(parts[1]);
      }
    }
    const body = $("body").text();
    let address: string | null = null;
    const addrMatch = body.match(/Address:\s*([^\n]+)/i);
    if (addrMatch) address = addrMatch[1].trim().replace(/\s*Directions:.*$/i, "").trim().slice(0, 255);
    let description: string | null = null;
    const firstP = $("h1").first().nextAll("p").first().text().trim();
    if (firstP && firstP.length > 20) description = firstP.slice(0, 5000);
    let imageUrl: string | null = null;
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage && ogImage.startsWith("http")) imageUrl = ogImage;
    if (!imageUrl) {
      const img = $("article img, .content img, main img").first().attr("src");
      if (img && img.startsWith("http")) imageUrl = img;
    }
    return {
      name,
      city,
      state,
      description,
      address,
      sourceUrl: `${BASE}/tip/${tipId}`,
      imageUrl,
    };
  } catch (e) {
    console.warn(`Failed to parse tip ${tipId}:`, (e as Error).message);
    return null;
  }
}

/** Parse one story page into { name, city, state, description, address, sourceUrl, imageUrl } */
async function parseStoryPage(storyId: string): Promise<{
  name: string;
  city: string | null;
  state: string;
  description: string | null;
  address: string | null;
  sourceUrl: string;
  imageUrl: string | null;
} | null> {
  try {
    const html = await fetchHtml(`/story/${storyId}`);
    const $ = cheerio.load(html);
    const name = $("h1").first().text().trim();
    if (!name) return null;

    let city: string | null = null;
    let state = "US";
    const sub = $("h1").first().next().text().trim();
    if (sub) {
      const match = sub.match(/^([^,]+),\s*\[?([^\]]+)\]?$/);
      if (match) {
        city = match[1].trim();
        state = stateNameToCode(match[2].trim());
      } else {
        const parts = sub.split(",").map((s) => s.trim());
        if (parts.length >= 2) {
          city = parts[0];
          state = stateNameToCode(parts[1]);
        }
      }
    }

    const paragraphs: string[] = [];
    $("article p, .story-content p, .content p, main p").each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 30) paragraphs.push(t);
    });
    const description = paragraphs.length ? paragraphs.join("\n\n").slice(0, 5000) : null;

    let address: string | null = null;
    const body = $("body").text();
    const addrMatch = body.match(/Address:\s*([^\n]+)/i);
    if (addrMatch) address = addrMatch[1].trim().slice(0, 255);

    // If city/state weren't in the subtitle, try to parse from address (e.g. "..., Andalusia, ALDirections:")
    if ((!city || state === "US") && address) {
      const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
      for (let i = parts.length - 1; i >= 1; i--) {
        const part = parts[i].replace(/Directions.*$/i, "").trim();
        if (/^[A-Z]{2}$/i.test(part)) {
          if (!city) city = parts[i - 1] || null;
          if (state === "US") state = part.toUpperCase();
          break;
        }
      }
    }

    let imageUrl: string | null = null;
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage && ogImage.startsWith("http")) imageUrl = ogImage;

    return {
      name,
      city,
      state,
      description,
      address,
      sourceUrl: `${BASE}/story/${storyId}`,
      imageUrl,
    };
  } catch (e) {
    console.warn(`Failed to parse story ${storyId}:`, (e as Error).message);
    return null;
  }
}

async function main() {
  const importDb = process.argv.includes("--db");
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx >= 0 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1], 10) : 0;
  const stateIdx = process.argv.indexOf("--state");
  const stateFilters: string[] = [];
  if (stateIdx >= 0) {
    for (let i = stateIdx + 1; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg.startsWith("--")) break;
      const code = arg.toLowerCase().trim();
      if (code.length === 2 && /^[a-z]{2}$/.test(code)) stateFilters.push(code);
    }
  }
  const tipIdx = process.argv.indexOf("--tip");
  const tipId = tipIdx >= 0 && process.argv[tipIdx + 1] ? process.argv[tipIdx + 1].trim() : null;
  const mufflerMan = process.argv.includes("--muffler-man");
  const storyIdx = process.argv.indexOf("--story");
  const storyIds: string[] = [];
  if (storyIdx >= 0) {
    for (let i = storyIdx + 1; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg.startsWith("--")) break;
      if (/^\d+$/.test(arg)) storyIds.push(arg);
    }
  }

  let valid: { name: string; city: string | null; state: string; description: string | null; address: string | null; sourceUrl: string; imageUrl: string | null }[];

  const importFile = process.argv.includes("--import-file");
  if (importFile) {
    const jsonPath = join(OUT_DIR, "scraped.json");
    if (!existsSync(jsonPath)) {
      console.error("No scraped.json found at", jsonPath);
      process.exit(1);
    }
    const raw = readFileSync(jsonPath, "utf-8");
    const rows: { name: string; city: string | null; state: string; description: string | null; address: string | null; sourceUrl: string; imageUrl: string | null }[] = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log("scraped.json is empty or invalid.");
      return;
    }
    console.log(`Importing ${rows.length} attractions from scraped.json${importDb ? " into database" : ""}.`);
    if (importDb) {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      const slug = "roadside-oddities";
      let cat = await prisma.category.findFirst({ where: { slug } });
      if (!cat) cat = await prisma.category.create({ data: { name: "Roadside Oddities", slug, icon: "🚗" } });
      let saved = 0;
      for (const row of rows) {
        if (!row?.sourceUrl) continue;
        let att = await prisma.attraction.findFirst({ where: { sourceUrl: row.sourceUrl } });
        if (!att) {
          att = await prisma.attraction.create({
            data: { name: row.name, city: row.city, state: row.state, description: row.description, address: row.address, sourceUrl: row.sourceUrl, imageUrl: row.imageUrl },
          });
        } else {
          await prisma.attraction.update({
            where: { id: att.id },
            data: {
              name: row.name,
              city: row.city,
              state: row.state,
              description: row.description,
              address: row.address,
              ...(row.imageUrl != null && { imageUrl: row.imageUrl }),
            },
          });
        }
        await prisma.attractionCategory.upsert({
          where: { attractionId_categoryId: { attractionId: att.id, categoryId: cat.id } },
          create: { attractionId: att.id, categoryId: cat.id },
          update: {},
        });
        saved++;
      }
      await prisma.$disconnect();
      console.log(`Saved ${saved} attractions to database (no duplicates by sourceUrl).`);
    }
    return;
  }

  if (mufflerMan) {
    console.log(`Scraping all Muffler Men from ${BASE}${MUFFLER_MAN_HUB}`);
    const { storyIds: mmStoryIds, tipIds: mmTipIds } = await getMufflerManIds();
    const total = mmStoryIds.length + mmTipIds.length;
    console.log(`Found ${mmStoryIds.length} stories and ${mmTipIds.length} tips (${total} total). Fetching each page and saving to DB as we go...\n`);
    await delay(DELAY_MS);

    let prisma: Awaited<ReturnType<typeof import("@prisma/client").PrismaClient>> | null = null;
    let mufflerManCat: { id: string } | null = null;
    if (importDb) {
      const { PrismaClient } = await import("@prisma/client");
      prisma = new PrismaClient();
      const slug = "muffler-man";
      mufflerManCat = await prisma.category.findFirst({ where: { slug } });
      if (!mufflerManCat) {
        mufflerManCat = await prisma.category.create({
          data: { name: "Muffler Man", slug, icon: "🦺" },
        });
      }
    }

    const results: Awaited<ReturnType<typeof parseStoryPage>>[] = [];
    let idx = 0;
    let savedCount = 0;

    const upsertOne = async (a: NonNullable<Awaited<ReturnType<typeof parseStoryPage>>>) => {
      if (!prisma || !mufflerManCat) return;
      let att = await prisma.attraction.findFirst({ where: { sourceUrl: a.sourceUrl } });
      if (!att) {
        att = await prisma.attraction.create({
          data: {
            name: a.name,
            city: a.city,
            state: a.state,
            description: a.description,
            address: a.address,
            sourceUrl: a.sourceUrl,
            imageUrl: a.imageUrl,
          },
        });
      } else {
        await prisma.attraction.update({
          where: { id: att.id },
          data: {
            name: a.name,
            city: a.city,
            state: a.state,
            description: a.description,
            address: a.address,
            imageUrl: a.imageUrl,
          },
        });
      }
      await prisma.attractionCategory.upsert({
        where: {
          attractionId_categoryId: { attractionId: att.id, categoryId: mufflerManCat.id },
        },
        create: { attractionId: att.id, categoryId: mufflerManCat.id },
        update: {},
      });
      savedCount++;
    };

    for (const id of mmStoryIds) {
      idx++;
      process.stdout.write(`[${idx}/${total}] Story ${id}... `);
      const row = await parseStoryPage(id);
      if (row) {
        results.push(row);
        if (importDb) await upsertOne(row);
        console.log(row.name.slice(0, 50) + (row.name.length > 50 ? "…" : "") + (importDb ? " ✓" : ""));
      } else {
        console.log("skip");
      }
      await delay(DELAY_MS);
    }
    for (const id of mmTipIds) {
      idx++;
      process.stdout.write(`[${idx}/${total}] Tip ${id}... `);
      const row = await parseTipPage(id);
      if (row) {
        results.push(row);
        if (importDb) await upsertOne(row);
        console.log(row.name.slice(0, 50) + (row.name.length > 50 ? "…" : "") + (importDb ? " ✓" : ""));
      } else {
        console.log("skip");
      }
      await delay(DELAY_MS);
    }

    if (prisma) {
      await prisma.$disconnect();
      if (importDb) console.log(`\nSaved ${savedCount} Muffler Men to database (no duplicates by sourceUrl).`);
    }

    valid = results.filter((r): r is NonNullable<typeof r> => r != null);
  } else if (tipId) {
    console.log(`Scraping single tip: ${BASE}/tip/${tipId}`);
    const row = await parseTipPage(tipId);
    valid = row ? [row] : [];
    if (valid.length) {
      console.log("Parsed:", valid[0].name);
      if (importDb && row) {
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient();
        const slug = "roadside-oddities";
        let cat = await prisma.category.findFirst({ where: { slug } });
        if (!cat) cat = await prisma.category.create({ data: { name: "Roadside Oddities", slug, icon: "🚗" } });
        let att = await prisma.attraction.findFirst({ where: { sourceUrl: row.sourceUrl } });
        if (!att) {
          att = await prisma.attraction.create({
            data: { name: row.name, city: row.city, state: row.state, description: row.description, address: row.address, sourceUrl: row.sourceUrl, imageUrl: row.imageUrl },
          });
        } else {
          await prisma.attraction.update({
            where: { id: att.id },
            data: {
              name: row.name,
              city: row.city,
              state: row.state,
              description: row.description,
              address: row.address,
              ...(row.imageUrl != null && { imageUrl: row.imageUrl }),
            },
          });
        }
        await prisma.attractionCategory.upsert({
          where: { attractionId_categoryId: { attractionId: att.id, categoryId: cat.id } },
          create: { attractionId: att.id, categoryId: cat.id },
          update: {},
        });
        await prisma.$disconnect();
        console.log("Saved to database (no duplicate).");
      }
    }
  } else if (storyIds.length > 0) {
    console.log(`Scraping ${storyIds.length} story/stories: ${storyIds.join(", ")}`);
    let storyPrisma: Awaited<ReturnType<typeof import("@prisma/client").PrismaClient>> | null = null;
    let storyCat: { id: string } | null = null;
    if (importDb) {
      const { PrismaClient } = await import("@prisma/client");
      storyPrisma = new PrismaClient();
      const slug = "roadside-oddities";
      storyCat = await storyPrisma.category.findFirst({ where: { slug } });
      if (!storyCat) storyCat = await storyPrisma.category.create({ data: { name: "Roadside Oddities", slug, icon: "🚗" } });
    }
    const results: Awaited<ReturnType<typeof parseStoryPage>>[] = [];
    for (let i = 0; i < storyIds.length; i++) {
      const id = storyIds[i];
      process.stdout.write(`[${i + 1}/${storyIds.length}] Story ${id}... `);
      const row = await parseStoryPage(id);
      if (row) {
        results.push(row);
        if (importDb && storyPrisma && storyCat) {
          let att = await storyPrisma.attraction.findFirst({ where: { sourceUrl: row.sourceUrl } });
          if (!att) {
            att = await storyPrisma.attraction.create({
              data: { name: row.name, city: row.city, state: row.state, description: row.description, address: row.address, sourceUrl: row.sourceUrl, imageUrl: row.imageUrl },
            });
          } else {
            await storyPrisma.attraction.update({
              where: { id: att.id },
              data: {
                name: row.name,
                city: row.city,
                state: row.state,
                description: row.description,
                address: row.address,
                ...(row.imageUrl != null && { imageUrl: row.imageUrl }),
              },
            });
          }
          await storyPrisma.attractionCategory.upsert({
            where: { attractionId_categoryId: { attractionId: att.id, categoryId: storyCat.id } },
            create: { attractionId: att.id, categoryId: storyCat.id },
            update: {},
          });
        }
        console.log(row.name.slice(0, 50) + (row.name.length > 50 ? "…" : "") + (importDb ? " ✓" : ""));
      } else {
        console.log("skip");
      }
      await delay(DELAY_MS);
    }
    if (storyPrisma) {
      await storyPrisma.$disconnect();
      if (importDb) console.log(`\nSaved ${results.length} to database (no duplicates by sourceUrl).`);
    }
    valid = results.filter((r): r is NonNullable<typeof r> => r != null);
  } else {
    console.log("Scraping RoadsideAmerica.com (rate-limited). Use --db to import into database after.");
    if (stateFilters.length > 0) {
      console.log(`State filter: ${stateFilters.map((s) => s.toUpperCase()).join(", ")} (every attraction).`);
    }
    if (limit > 0 && stateFilters.length === 0) console.log(`Limiting to first ${limit} stories (use --limit N).`);
    console.log("");

    type Task = { type: "story"; id: string } | { type: "tip"; id: string };
    const allStoryIds = new Set<string>();
    const allTipIds = new Set<string>();
    const statesToFetch = stateFilters.length > 0 ? stateFilters : STATE_CODES;
    for (const state of statesToFetch) {
      process.stdout.write(`Fetching state ${state.toUpperCase()}... `);
      const { storyIds, tipIds } = await getStateIds(state);
      storyIds.forEach((id) => allStoryIds.add(id));
      tipIds.forEach((id) => allTipIds.add(id));
      console.log(`${storyIds.size} story, ${tipIds.size} tip (total unique: ${allStoryIds.size + allTipIds.size})`);
      await delay(DELAY_MS);
    }

    const tasks: Task[] = [
      ...Array.from(allStoryIds).map((id) => ({ type: "story" as const, id })),
      ...Array.from(allTipIds).map((id) => ({ type: "tip" as const, id })),
    ];
    let taskList = tasks;
    if (limit > 0 && stateFilters.length === 0) taskList = tasks.slice(0, limit);
    console.log(`\nFound ${taskList.length} items to fetch (${allStoryIds.size} stories, ${allTipIds.size} tips). Fetching each page${importDb ? " and saving to DB as we go" : ""}...\n`);

    let statePrisma: Awaited<ReturnType<typeof import("@prisma/client").PrismaClient>> | null = null;
    let stateCat: { id: string } | null = null;
    if (importDb) {
      const { PrismaClient } = await import("@prisma/client");
      statePrisma = new PrismaClient();
      const slug = "roadside-oddities";
      stateCat = await statePrisma.category.findFirst({ where: { slug } });
      if (!stateCat) stateCat = await statePrisma.category.create({ data: { name: "Roadside Oddities", slug, icon: "🚗" } });
    }

    const results: Awaited<ReturnType<typeof parseStoryPage>>[] = [];
    let stateSavedCount = 0;
    for (let i = 0; i < taskList.length; i++) {
      const task = taskList[i];
      const label = task.type === "story" ? `Story ${task.id}` : `Tip ${task.id}`;
      process.stdout.write(`[${i + 1}/${taskList.length}] ${label}... `);
      const row = task.type === "story" ? await parseStoryPage(task.id) : await parseTipPage(task.id);
      if (row) {
        results.push(row);
        if (importDb && statePrisma && stateCat) {
          let att = await statePrisma.attraction.findFirst({ where: { sourceUrl: row.sourceUrl } });
          if (!att) {
            att = await statePrisma.attraction.create({
              data: { name: row.name, city: row.city, state: row.state, description: row.description, address: row.address, sourceUrl: row.sourceUrl, imageUrl: row.imageUrl },
            });
          } else {
            await statePrisma.attraction.update({
              where: { id: att.id },
              data: {
                name: row.name,
                city: row.city,
                state: row.state,
                description: row.description,
                address: row.address,
                ...(row.imageUrl != null && { imageUrl: row.imageUrl }),
              },
            });
          }
          await statePrisma.attractionCategory.upsert({
            where: { attractionId_categoryId: { attractionId: att.id, categoryId: stateCat.id } },
            create: { attractionId: att.id, categoryId: stateCat.id },
            update: {},
          });
          stateSavedCount++;
        }
        console.log(row.name.slice(0, 40) + (row.name.length > 40 ? "…" : "") + (importDb ? " ✓" : ""));
      } else {
        console.log("skip");
      }
      await delay(DELAY_MS);
    }

    if (statePrisma) {
      await statePrisma.$disconnect();
      if (importDb) console.log(`\nSaved ${stateSavedCount} to database (no duplicates by sourceUrl).`);
    }

    valid = results.filter((r): r is NonNullable<typeof r> => r != null);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, mufflerMan ? "scraped-muffler-man.json" : "scraped.json");
  writeFileSync(outPath, JSON.stringify(valid, null, 2), "utf-8");
  console.log(`\nWrote ${valid.length} attractions to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
