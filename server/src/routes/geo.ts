import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

/**
 * "Where in the USA?" — a GeoGuessr-style game. Each round shows an attraction
 * (photo + name); the player drops a pin on the map guessing where it is, and
 * scores by how close they are. Coordinates are never sent to the client up
 * front — the round endpoint returns photo + name only, and the actual
 * location is revealed by /guess after the player commits, so it can't be
 * read out of the network response.
 */

const ROUND_DEFAULT = 5;
const ROUND_MAX = 10;
const MAX_POINTS = 5000;

// Continental-US box so guesses live on a US map (keeps AK/HI/PR outliers out).
const BBOX = { minLat: 24.5, maxLat: 49.5, minLng: -125, maxLng: -66.5 };

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 5000 at the bullseye, decaying with distance (≈1840 at 500 mi, ≈680 at 1000 mi). */
function scoreFor(distanceMiles: number): number {
  return Math.max(0, Math.round(MAX_POINTS * Math.exp(-distanceMiles / 500)));
}

export async function geoRoutes(app: FastifyInstance) {
  // A fresh set of random attractions (photo + name only — no coordinates).
  app.get("/round", async (req: FastifyRequest, reply: FastifyReply) => {
    const nRaw = Number((req.query as { n?: string }).n);
    const n = Number.isFinite(nRaw) ? Math.min(ROUND_MAX, Math.max(1, Math.floor(nRaw))) : ROUND_DEFAULT;
    const rows = await prisma.$queryRawUnsafe<{ id: string; name: string; imageUrl: string }[]>(
      `SELECT id, name, image_url AS "imageUrl"
         FROM attractions
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
          AND image_url IS NOT NULL AND image_url <> ''
          AND latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
        ORDER BY random()
        LIMIT $5`,
      BBOX.minLat,
      BBOX.maxLat,
      BBOX.minLng,
      BBOX.maxLng,
      n
    );
    if (rows.length === 0) return reply.status(503).send({ error: "No locations available" });
    return reply.send({ rounds: rows, maxPoints: MAX_POINTS });
  });

  // Score a guess: returns distance, points, and the real location to reveal.
  app.post("/guess", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z
      .object({ id: z.string().min(1), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Invalid guess" });

    const a = await prisma.attraction.findUnique({
      where: { id: body.data.id },
      select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, imageUrl: true, sourceUrl: true },
    });
    if (!a || a.latitude == null || a.longitude == null) {
      return reply.status(404).send({ error: "Location not found" });
    }

    const distanceMiles = haversineMiles(body.data.lat, body.data.lng, a.latitude, a.longitude);
    return reply.send({
      actual: { lat: a.latitude, lng: a.longitude },
      name: a.name,
      city: a.city,
      state: a.state,
      imageUrl: a.imageUrl,
      sourceUrl: a.sourceUrl,
      distanceMiles: Math.round(distanceMiles),
      points: scoreFor(distanceMiles),
    });
  });
}
