import crypto from "crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { gameDay, LAUNCH_SEED, resolveGameDay } from "./game.js";

/**
 * "Roadside Connections" — a daily NYT-Connections-style game. 16 attractions,
 * four hidden groups of four that share a trait (a keyword in the name, e.g.
 * "Museum", "Muffler Man", "World's Largest"). Overlapping keywords ("Giant
 * Paul Bunyan Statue") are the red herrings — but each tile is assigned to
 * exactly ONE group so every puzzle has a unique solution. Four mistakes
 * allowed. The day's puzzle is generated once and frozen in daily_connections.
 */

const GROUP_COUNT = 4;
const GROUP_SIZE = 4;
const MAX_MISTAKES = 4;

/** Candidate traits: a label + a word-boundary matcher over the attraction name. */
const TRAITS: { key: string; label: string; re: RegExp }[] = [
  { key: "giant", label: "Giant ___", re: /\bgiant\b/i },
  { key: "worlds-largest", label: "World's Largest ___", re: /world'?s\s+largest/i },
  { key: "museum", label: "___ Museum", re: /\bmuseums?\b/i },
  { key: "statue", label: "___ Statue", re: /\bstatues?\b/i },
  { key: "dinosaur", label: "Dinosaurs", re: /\bdinosaurs?\b/i },
  { key: "paul-bunyan", label: "Paul Bunyan", re: /\bpaul\s+bunyan\b/i },
  { key: "muffler-man", label: "Muffler Men", re: /\bmuffler\s+m(?:an|en)\b/i },
  { key: "water-tower", label: "Water Towers", re: /\bwater\s+towers?\b/i },
  { key: "cow", label: "Cows", re: /\bcows?\b/i },
  { key: "chicken", label: "Chickens", re: /\bchickens?\b/i },
  { key: "bigfoot", label: "Bigfoot & Sasquatch", re: /\b(?:bigfoot|sasquatch)\b/i },
  { key: "ufo", label: "UFOs & Aliens", re: /\b(?:ufos?|aliens?|flying\s+saucers?)\b/i },
  { key: "elephant", label: "Elephants", re: /\belephants?\b/i },
  { key: "castle", label: "Castles", re: /\bcastles?\b/i },
  { key: "train", label: "Trains", re: /\btrains?\b/i },
  { key: "bottle", label: "Bottles", re: /\bbottles?\b/i },
  { key: "ball", label: "Giant Balls", re: /\bballs?\b/i },
  { key: "rocket", label: "Rockets", re: /\brockets?\b/i },
];

type Tile = { id: string; name: string };
type Group = { key: string; label: string; level: number; ids: string[] };
type Payload = { groups: Group[]; tiles: Tile[] };

/** Deterministic PRNG (mulberry32) so the same day always builds the same puzzle. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Build (and never re-build) the day's puzzle from the current pool. */
async function generate(seed: number): Promise<Payload | null> {
  const rows = await prisma.attraction.findMany({
    where: { imageUrl: { not: null }, name: { not: "" } },
    select: { id: true, name: true },
  });
  // Tag each attraction with the traits its name matches.
  const tagged = rows
    .filter((r) => r.name.length >= 3 && r.name.length <= 48)
    .map((r) => ({ id: r.id, name: r.name, traits: TRAITS.filter((t) => t.re.test(r.name)).map((t) => t.key) }))
    .filter((r) => r.traits.length > 0);

  const rand = makeRng(seed);
  const order = shuffle(TRAITS, rand);

  // Exclusive members of trait `k` given the already-chosen set: matches k and
  // none of the other chosen traits.
  const exclusive = (k: string, chosen: string[]) =>
    tagged.filter((r) => r.traits.includes(k) && r.traits.every((x) => x === k || !chosen.includes(x)));

  // Greedily pick GROUP_COUNT traits that can each field GROUP_SIZE unique tiles.
  const chosen: string[] = [];
  for (const t of order) {
    const trial = [...chosen, t.key];
    if (trial.every((k) => exclusive(k, trial).length >= GROUP_SIZE)) {
      chosen.push(t.key);
      if (chosen.length === GROUP_COUNT) break;
    }
  }
  if (chosen.length < GROUP_COUNT) return null;

  // Pick GROUP_SIZE tiles per trait; order groups by pool size (bigger = easier = lower level).
  const built = chosen
    .map((k) => {
      const pool = shuffle(exclusive(k, chosen), rand);
      const picks = pool.slice(0, GROUP_SIZE);
      const trait = TRAITS.find((t) => t.key === k)!;
      return { key: k, label: trait.label, ids: picks.map((p) => p.id), poolSize: pool.length };
    })
    .sort((a, b) => b.poolSize - a.poolSize);

  const groups: Group[] = built.map((g, level) => ({ key: g.key, label: g.label, level, ids: g.ids }));

  const idToName = new Map(tagged.map((r) => [r.id, r.name] as const));
  const allIds = groups.flatMap((g) => g.ids);
  const tiles: Tile[] = shuffle(allIds, rand).map((id) => ({ id, name: idToName.get(id)! }));

  return { groups, tiles };
}

/** Resolve (and lock) the day's payload. */
async function getPayload(date: string, seed: number): Promise<Payload | null> {
  const existing = await prisma.dailyConnections.findUnique({ where: { date } });
  if (existing) return existing.payload as unknown as Payload;

  const payload = await generate(seed);
  if (!payload) return null;
  try {
    await prisma.dailyConnections.create({ data: { date, payload: payload as object } });
  } catch {
    const winner = await prisma.dailyConnections.findUnique({ where: { date } });
    if (winner) return winner.payload as unknown as Payload;
  }
  return payload;
}

function puzzleKeyFor(tiles: Tile[]): string {
  const sig = tiles.map((t) => t.id).sort().join(",");
  return crypto.createHash("sha1").update(sig).digest("hex").slice(0, 12);
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");

export async function connectionsRoutes(app: FastifyInstance) {
  // The day's tiles (no group assignments). ?date plays an archived puzzle.
  app.get("/", async (req: FastifyRequest, reply: FastifyReply) => {
    const day = resolveGameDay((req.query as { date?: string }).date);
    if (!day) return reply.status(400).send({ error: "Invalid or out-of-range date" });
    const payload = await getPayload(day.date, day.seed);
    if (!payload) return reply.status(503).send({ error: "No puzzle available" });
    return reply.send({
      date: day.date,
      number: day.seed - LAUNCH_SEED + 1,
      puzzleKey: puzzleKeyFor(payload.tiles),
      groupCount: GROUP_COUNT,
      groupSize: GROUP_SIZE,
      maxMistakes: MAX_MISTAKES,
      tiles: payload.tiles,
    });
  });

  // Submit 4 tile ids. Returns the solved group, or one-away feedback.
  app.post("/guess", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({ ids: z.array(z.string()).length(GROUP_SIZE), date: z.string().optional() }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Pick exactly four" });
    const day = resolveGameDay(body.data.date);
    if (!day) return reply.status(400).send({ error: "Invalid or out-of-range date" });
    const payload = await getPayload(day.date, day.seed);
    if (!payload) return reply.status(503).send({ error: "No puzzle available" });

    const ids = [...new Set(body.data.ids)];
    const valid = new Set(payload.tiles.map((t) => t.id));
    if (ids.length !== GROUP_SIZE || !ids.every((i) => valid.has(i))) {
      return reply.status(400).send({ error: "Invalid selection" });
    }

    const match = payload.groups.find((g) => sameSet(g.ids, ids));
    if (match) {
      return reply.send({ correct: true, group: { key: match.key, label: match.label, level: match.level, ids: match.ids } });
    }
    const maxOverlap = Math.max(...payload.groups.map((g) => g.ids.filter((id) => ids.includes(id)).length));
    return reply.send({ correct: false, oneAway: maxOverlap === GROUP_SIZE - 1 });
  });

  // Full solution — for the end-of-game reveal only.
  app.get("/answer", async (req: FastifyRequest, reply: FastifyReply) => {
    const day = resolveGameDay((req.query as { date?: string }).date);
    if (!day) return reply.status(400).send({ error: "Invalid or out-of-range date" });
    const payload = await getPayload(day.date, day.seed);
    if (!payload) return reply.status(503).send({ error: "No puzzle available" });
    const nameOf = new Map(payload.tiles.map((t) => [t.id, t.name] as const));
    return reply.send({
      groups: payload.groups.map((g) => ({
        key: g.key,
        label: g.label,
        level: g.level,
        tiles: g.ids.map((id) => ({ id, name: nameOf.get(id) ?? "" })),
      })),
    });
  });
}
