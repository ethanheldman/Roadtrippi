/**
 * Backfill missing attraction images from Roadside America.
 *
 * Uses Prisma (already a dep of this server) and runs as plain ESM, so it
 * doesn't need tsx / esbuild and works on any platform.
 *
 *   cd server
 *   set -a && source .env && set +a
 *   node scripts/backfill-images-pg.mjs [--limit N] [--delay-ms 600] [--concurrency 3]
 *                                        [--dry-run] [--fix-mismatches]
 *
 * --dry-run            Print intended updates without writing.
 * --fix-mismatches     Re-process attractions whose current image_url state
 *                      doesn't match the attraction's state (RA sometimes
 *                      editorially substitutes a related-sight icon from
 *                      another state). Updates only when a state-matched
 *                      image is found on the same RA page.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "https://www.roadsideamerica.com";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : fallback;
}
function has(name) { return args.includes("--" + name); }

const LIMIT = flag("limit", 0);
const DELAY_MS = flag("delay-ms", 1500);
const CONCURRENCY = flag("concurrency", 4);
const DRY_RUN = has("dry-run");
const FIX_MISMATCHES = has("fix-mismatches");

const http = axios.create({
  baseURL: BASE,
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; Roadtrippi/1.0; +https://roadtrippi.com)",
    Accept: "text/html,application/xhtml+xml",
  },
});

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function toAbs(url) {
  if (url.startsWith("http")) return url;
  return BASE.replace(/\/$/, "") + (url.startsWith("/") ? url : "/" + url);
}

// Reject these — RA site chrome / logos / placeholders / sidebar promos.
function isJunkImage(url) {
  if (!url) return true;
  const u = url.toLowerCase();
  return (
    u.includes("roadside-america-logo") ||
    u.includes("/logo") ||
    u.includes("placeholder") ||
    u.includes("ra_logo") ||
    u.includes("default") ||
    u.endsWith(".svg") ||
    u.includes("_sow") ||             // Sight of the Week sidebar
    u.includes("mysights") ||
    u.includes("ra-app-art") ||
    u.includes("r66-app-art") ||
    u.includes("cities-web-list-art") ||
    u.includes("xother/generic")      // RA generic category placeholder
  );
}

function extractImage(html, stateHint) {
  const $ = cheerio.load(html);
  const stateLower =
    stateHint && stateHint.length === 2 && stateHint !== "US"
      ? stateHint.toLowerCase()
      : null;

  // Collect every /attract/ image on the page in DOM order, junk filtered out.
  const candidates = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    if (!src.includes("/attract/")) return;
    if (isJunkImage(src)) return;
    candidates.push(src.trim());
  });

  if (candidates.length === 0) {
    const og = $('meta[property="og:image"]').attr("content");
    if (og && !isJunkImage(og)) return toAbs(og.trim());
    return null;
  }

  // PRIORITY 1: an image whose URL state segment matches the attraction's state.
  // RA URLs are like /attract/images/<state>/<NAME>.jpg — the <state> is reliable
  // EXCEPT for the h1 "icon" which RA sometimes editorially replaces with a
  // related sight from a different state when the original photo is lost.
  if (stateLower) {
    const stateRe = new RegExp(`/attract/images(?:-icon)?/${stateLower}/`, "i");
    const stateMatched = candidates.find((c) => stateRe.test(c));
    if (stateMatched) return toAbs(stateMatched);
  }

  // PRIORITY 2: first non-junk /attract/ image in DOM order (the h1 icon).
  return toAbs(candidates[0]);
}

async function fetchImage(url, stateHint) {
  try {
    const path = url.replace(BASE, "").replace(/^\/+/, "") || "";
    const r = await http.get("/" + path);
    return extractImage(typeof r.data === "string" ? r.data : "", stateHint);
  } catch {
    return null;
  }
}

async function loadCandidates() {
  if (FIX_MISMATCHES) {
    // Raw SQL — Prisma's query builder doesn't easily express the regex check.
    const limitClause = LIMIT > 0 ? Prisma.sql`LIMIT ${LIMIT}` : Prisma.sql``;
    const rows = await prisma.$queryRaw`
      SELECT id, name, state, source_url AS "sourceUrl"
      FROM attractions
      WHERE image_url ILIKE '%roadsideamerica.com/attract/%'
        AND state IS NOT NULL
        AND length(state) = 2
        AND state <> 'US'
        AND image_url !~* ('/' || lower(state) || '/')
        AND source_url IS NOT NULL
        AND (
          source_url ILIKE '%roadsideamerica.com/tip/%'
          OR source_url ILIKE '%roadsideamerica.com/story/%'
        )
      ORDER BY name
      ${limitClause}
    `;
    return rows;
  }

  return await prisma.attraction.findMany({
    where: {
      OR: [{ imageUrl: null }, { imageUrl: "" }],
      sourceUrl: { not: null },
      AND: [{
        OR: [
          { sourceUrl: { contains: "roadsideamerica.com/tip/", mode: "insensitive" } },
          { sourceUrl: { contains: "roadsideamerica.com/story/", mode: "insensitive" } },
        ],
      }],
    },
    select: { id: true, name: true, state: true, sourceUrl: true },
    take: LIMIT > 0 ? LIMIT : undefined,
    orderBy: { createdAt: "desc" },
  });
}

async function main() {
  const rows = await loadCandidates();

  console.log(`Mode: ${FIX_MISMATCHES ? "fix-mismatches" : "backfill-missing"}`);
  console.log(`Found ${rows.length} attractions to process.`);
  console.log(`Concurrency: ${CONCURRENCY}, delay/request/worker: ${DELAY_MS}ms, dry-run: ${DRY_RUN}`);
  console.log(`ETA: ~${Math.ceil(rows.length * DELAY_MS / CONCURRENCY / 1000 / 60)} minutes\n`);

  const queue = rows.slice();
  let updated = 0, attempted = 0, failed = 0;

  async function worker(id) {
    while (true) {
      const a = queue.shift();
      if (!a) break;
      attempted++;
      const imageUrl = await fetchImage(a.sourceUrl, a.state);
      if (imageUrl) {
        if (!DRY_RUN) {
          try {
            await prisma.attraction.update({
              where: { id: a.id },
              data: { imageUrl },
            });
          } catch (e) {
            failed++;
            console.error(`  [w${id} db-fail] ${a.name}: ${e.message}`);
            continue;
          }
        }
        updated++;
        const tag = DRY_RUN ? "would-set" : "set";
        const trunc = imageUrl.length > 70 ? imageUrl.slice(0, 70) + "…" : imageUrl;
        console.log(`  [w${id} ${updated}] ${tag} ${a.name} (${a.state}) → ${trunc}`);
      } else {
        failed++;
      }
      await delay(DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
  await prisma.$disconnect();
  console.log(`\nDone. Attempted ${attempted}. Updated ${updated}. Failed/no-image ${failed}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
