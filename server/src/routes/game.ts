import crypto from "crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { STATE_CODE_TO_NAME } from "../lib/states.js";

/**
 * "Daily Detour" — a once-a-day, Pinpoint-style guessing game.
 *
 * Everyone gets the SAME mystery roadside attraction each day. Five clues are
 * revealed one at a time (broad → giveaway); the player has five guesses. The
 * answer's name/id never ship in the /daily payload — guesses are validated
 * server-side via /guess, and the reveal is fetched from /answer only once the
 * client's game is over.
 *
 * Statelessness on serverless: the puzzle is chosen deterministically from the
 * calendar date, so any cold instance can recompute the same answer for /guess
 * and /answer without a session store.
 */

const MAX_GUESSES = 5;
const TOTAL_CLUES = 5;

// Only attractions with an image, a town, and a *real* description make good
// puzzles. The generic "<State> roadside attraction in <City>." rows leak the
// city/state and carry no flavor, so they're excluded.
const POOL_WHERE = {
  imageUrl: { not: null },
  city: { not: null },
  description: { not: null },
  NOT: { description: { contains: "roadside attraction in", mode: "insensitive" as const } },
};

/**
 * The "game day": a YYYY-MM-DD string and an integer day-seed, anchored to US
 * Eastern time so the puzzle rolls over at midnight ET (DST-safe via Intl)
 * rather than mid-evening at UTC midnight.
 */
function gameDay(now = new Date()): { date: string; seed: number } {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // en-CA gives YYYY-MM-DD
  const [y, m, d] = date.split("-").map(Number);
  const seed = Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
  return { date, seed };
}

// Puzzle #1 = the first day on/after launch. Used only for the displayed number.
const LAUNCH_SEED = Math.floor(Date.UTC(2026, 0, 1) / 86_400_000);

type DailyAttraction = {
  id: string;
  name: string;
  city: string | null;
  state: string;
  description: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  attractionCategories: { category: { name: string } }[];
};

const DAILY_SELECT = {
  id: true,
  name: true,
  city: true,
  state: true,
  description: true,
  imageUrl: true,
  sourceUrl: true,
  attractionCategories: { select: { category: { select: { name: true } } } },
} as const;

/** Pick the attraction for a day-seed from the CURRENT pool (used once, when locking the day). */
async function pickDailyAttraction(seed: number): Promise<DailyAttraction | null> {
  const total = await prisma.attraction.count({ where: POOL_WHERE });
  if (total === 0) return null;
  const index = ((seed % total) + total) % total;
  const rows = await prisma.attraction.findMany({
    where: POOL_WHERE,
    orderBy: { id: "asc" },
    skip: index,
    take: 1,
    select: DAILY_SELECT,
  });
  return (rows[0] as DailyAttraction) ?? null;
}

/**
 * Resolve today's attraction, locking it in the daily_puzzles table on first
 * use so it can NEVER change for the rest of the day — even while the
 * attractions pool is mutating (scrape/dedup). If a previously-locked row was
 * since deleted, re-pick and overwrite the lock.
 */
async function getDailyAttraction(date: string, seed: number): Promise<DailyAttraction | null> {
  const lock = await prisma.dailyPuzzle.findUnique({ where: { date } });
  if (lock) {
    const existing = await prisma.attraction.findUnique({
      where: { id: lock.attractionId },
      select: DAILY_SELECT,
    });
    if (existing) return existing as DailyAttraction;
  }

  const picked = await pickDailyAttraction(seed);
  if (!picked) return null;
  try {
    await prisma.dailyPuzzle.upsert({
      where: { date },
      create: { date, attractionId: picked.id },
      update: { attractionId: picked.id },
    });
    return picked;
  } catch {
    // Race: another request locked it first — honor whatever is stored.
    const winner = await prisma.dailyPuzzle.findUnique({ where: { date } });
    if (winner) {
      const a = await prisma.attraction.findUnique({ where: { id: winner.attractionId }, select: DAILY_SELECT });
      if (a) return a as DailyAttraction;
    }
    return picked;
  }
}

/** Opaque, non-revealing fingerprint of the day's answer; changes if the answer changes. */
function puzzleKeyFor(attractionId: string): string {
  return crypto.createHash("sha1").update(attractionId).digest("hex").slice(0, 12);
}

/** Redact answer-revealing terms (the name, its longer words, the town) from the description clue. */
function maskText(text: string, terms: string[]): string {
  const unique = [...new Set(terms.filter((t) => t && t.trim().length >= 3))].sort(
    (a, b) => b.length - a.length
  );
  let out = text;
  for (const term of unique) {
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "gi"), (m) => "▒".repeat(Math.min(Math.max(m.length, 3), 8)));
  }
  return out;
}

type Clue = { type: "category" | "state" | "description" | "city" | "image"; label: string; value: string };

/** Ordered clues, broad → giveaway. The name/id are never included. */
function buildClues(a: DailyAttraction): Clue[] {
  const cats = a.attractionCategories.map((c) => c.category.name);
  const nameWords = a.name.split(/[\s\-]+/).filter((w) => w.length >= 4);
  const masked = maskText(a.description ?? "", [a.name, ...nameWords, a.city ?? ""]);
  const stateName = STATE_CODE_TO_NAME[a.state] ?? a.state;
  return [
    { type: "category", label: "Category", value: cats.length ? cats.join(" · ") : "Roadside oddity" },
    { type: "state", label: "State", value: stateName },
    { type: "description", label: "The clue", value: masked || "(no description)" },
    { type: "city", label: "Nearest town", value: `${a.city}, ${a.state}` },
    { type: "image", label: "Photo", value: a.imageUrl ?? "" },
  ];
}

export async function gameRoutes(app: FastifyInstance) {
  // Today's puzzle: clues only, no answer.
  app.get("/daily", async (_req: FastifyRequest, reply: FastifyReply) => {
    const { date, seed } = gameDay();
    const a = await getDailyAttraction(date, seed);
    if (!a) return reply.status(503).send({ error: "No puzzle available today" });
    return reply.send({
      date,
      number: seed - LAUNCH_SEED + 1,
      puzzleKey: puzzleKeyFor(a.id),
      maxGuesses: MAX_GUESSES,
      totalClues: TOTAL_CLUES,
      clues: buildClues(a),
    });
  });

  // Validate a guess against today's answer. Returns only correct/incorrect.
  app.post("/guess", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({ attractionId: z.string().min(1) }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Invalid guess" });
    const { date, seed } = gameDay();
    const a = await getDailyAttraction(date, seed);
    if (!a) return reply.status(503).send({ error: "No puzzle available today" });
    return reply.send({ correct: body.data.attractionId === a.id });
  });

  // The reveal — fetched by the client only after the game ends (win or loss).
  app.get("/answer", async (_req: FastifyRequest, reply: FastifyReply) => {
    const { date, seed } = gameDay();
    const a = await getDailyAttraction(date, seed);
    if (!a) return reply.status(503).send({ error: "No puzzle available today" });
    return reply.send({
      id: a.id,
      name: a.name,
      city: a.city,
      state: a.state,
      imageUrl: a.imageUrl,
      sourceUrl: a.sourceUrl,
    });
  });
}
