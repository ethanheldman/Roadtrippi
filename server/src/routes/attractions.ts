import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { resolveCityState } from "../lib/address.js";

/** Haversine distance in miles between two lat/lng points */
function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(24),
  state: z.string().length(2).optional(),
  city: z.string().max(100).optional(),
  search: z.string().optional(),
  category: z.string().max(100).optional(),
  sortBy: z.enum(["name", "state", "city", "createdAt", "visitCount", "rating", "distance"]).optional().default("name"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
  lat: z.string().optional(),
  lng: z.string().optional(),
  radiusMiles: z.coerce.number().min(1).max(500).default(50),
});

type WhereAttraction = {
  state?: string;
  city?: string | { contains: string };
  name?: { contains: string };
  attractionCategories?: { some: { category: { slug: string } } };
};

export async function attractionsRoutes(app: FastifyInstance) {
  /** All attractions with coordinates for the map (id, name, city, state, lat, lng, imageUrl, sourceUrl) */
  app.get("/map", async (_request, reply) => {
    const attractions = await prisma.attraction.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        address: true,
        latitude: true,
        longitude: true,
        imageUrl: true,
        sourceUrl: true,
      },
    });
    const items = attractions.map((a) => {
      const { city, state } = resolveCityState(a.city, a.state, a.address);
      return {
        id: a.id,
        name: a.name,
        city,
        state,
        latitude: a.latitude!,
        longitude: a.longitude!,
        imageUrl: a.imageUrl ?? undefined,
        sourceUrl: a.sourceUrl ?? undefined,
      };
    });
    return reply.send({ items });
  });

  /** List categories for filters */
  app.get("/categories", async (_request, reply) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, icon: true },
    });
    return reply.send({ items: categories });
  });

  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const q = querySchema.safeParse(request.query);
    if (!q.success) {
      return reply.status(400).send({ error: q.error.flatten() });
    }
    const { page, limit, state, city, search, category, sortBy, sortOrder, lat, lng } = q.data;
    const skip = (page - 1) * limit;
    const where: WhereAttraction = {};
    if (state) where.state = state;
    if (city?.trim()) where.city = { contains: city.trim() };
    if (search?.trim()) where.name = { contains: search.trim() };
    if (category?.trim()) where.attractionCategories = { some: { category: { slug: category.trim() } } };

    const userLat = lat != null ? parseFloat(lat) : null;
    const userLng = lng != null ? parseFloat(lng) : null;
    const hasUserLocation = userLat != null && !Number.isNaN(userLat) && userLng != null && !Number.isNaN(userLng);

    if (sortBy === "distance") {
      if (!hasUserLocation) {
        return reply.status(400).send({ error: "lat and lng required when sortBy is distance" });
      }
      const withCoords = await prisma.attraction.findMany({
        where: { ...where, latitude: { not: null }, longitude: { not: null } },
        select: { id: true, latitude: true, longitude: true },
      });
      const withDistance = withCoords
        .map((a) => ({
          id: a.id,
          distanceMiles: distanceMiles(userLat!, userLng!, a.latitude!, a.longitude!),
        }))
        .sort((a, b) => (sortOrder === "asc" ? a.distanceMiles - b.distanceMiles : b.distanceMiles - a.distanceMiles));
      const total = withDistance.length;
      const pageIds = withDistance.slice(skip, skip + limit).map((x) => x.id);
      const distanceById = Object.fromEntries(withDistance.map((x) => [x.id, x.distanceMiles]));

      const attractions = await prisma.attraction.findMany({
        where: { id: { in: pageIds } },
        include: {
          attractionCategories: { include: { category: true } },
          _count: { select: { checkIns: true } },
        },
      });
      const orderIndex = Object.fromEntries(pageIds.map((id, i) => [id, i]));
      attractions.sort((a, b) => orderIndex[a.id]! - orderIndex[b.id]!);

      const ids = attractions.map((a) => a.id);
      const ratingStats = ids.length
        ? await prisma.checkIn.groupBy({
            by: ["attractionId"],
            _avg: { rating: true },
            _count: { id: true },
            where: { attractionId: { in: ids }, rating: { not: null } },
          })
        : [];
      const ratingByAttraction: Record<string, { avg: number; count: number }> = {};
      for (const s of ratingStats) {
        ratingByAttraction[s.attractionId] = {
          avg: s._avg.rating != null ? Math.round(s._avg.rating * 10) / 10 : 0,
          count: s._count.id,
        };
      }

      const items = attractions.map((a) => {
        const { city: c, state: s } = resolveCityState(a.city, a.state, a.address);
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          city: c,
          state: s,
          latitude: a.latitude?.toString(),
          longitude: a.longitude?.toString(),
          imageUrl: a.imageUrl ?? undefined,
          sourceUrl: a.sourceUrl,
          visitCount: a._count.checkIns,
          avgRating: ratingByAttraction[a.id]?.avg ?? null,
          ratingCount: ratingByAttraction[a.id]?.count ?? 0,
          categories: a.attractionCategories.map((ac) => ac.category).sort((a, b) => a.name.localeCompare(b.name)),
          distanceMiles: distanceById[a.id] ?? null,
        };
      });
      return reply.send({ items, total, page, limit });
    }

    if (sortBy === "rating") {
      const matching = await prisma.attraction.findMany({
        where,
        select: { id: true },
      });
      const allIds = matching.map((a) => a.id);
      const total = allIds.length;

      const ratingStats =
        allIds.length > 0
          ? await prisma.checkIn.groupBy({
              by: ["attractionId"],
              _avg: { rating: true },
              _count: { id: true },
              where: { attractionId: { in: allIds }, rating: { not: null } },
            })
          : [];
      const avgByAttraction: Record<string, number> = {};
      const countByAttraction: Record<string, number> = {};
      for (const id of allIds) {
        avgByAttraction[id] = 0;
        countByAttraction[id] = 0;
      }
      for (const s of ratingStats) {
        avgByAttraction[s.attractionId] =
          s._avg.rating != null ? Math.round(s._avg.rating * 10) / 10 : 0;
        countByAttraction[s.attractionId] = s._count.id;
      }

      const sortedIds = [...allIds].sort((a, b) => {
        const diff = avgByAttraction[b]! - avgByAttraction[a]!;
        return sortOrder === "desc" ? diff : -diff;
      });
      const pageIds = sortedIds.slice(skip, skip + limit);

      const attractions = await prisma.attraction.findMany({
        where: { id: { in: pageIds } },
        include: {
          attractionCategories: { include: { category: true } },
          _count: { select: { checkIns: true } },
        },
      });
      const orderIndex = Object.fromEntries(pageIds.map((id, i) => [id, i]));
      attractions.sort((a, b) => orderIndex[a.id]! - orderIndex[b.id]!);

      const items = attractions.map((a) => {
        const { city, state } = resolveCityState(a.city, a.state, a.address);
        const avg = avgByAttraction[a.id] ?? 0;
        const dist =
          hasUserLocation && a.latitude != null && a.longitude != null
            ? distanceMiles(userLat!, userLng!, a.latitude, a.longitude)
            : null;
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          city,
          state,
          latitude: a.latitude?.toString(),
          longitude: a.longitude?.toString(),
          imageUrl: a.imageUrl ?? undefined,
          sourceUrl: a.sourceUrl,
          visitCount: a._count.checkIns,
          avgRating: avg > 0 ? avg : null,
          ratingCount: countByAttraction[a.id] ?? 0,
          categories: a.attractionCategories.map((ac) => ac.category).sort((a, b) => a.name.localeCompare(b.name)),
          ...(dist != null && { distanceMiles: dist }),
        };
      });
      return reply.send({ items, total, page, limit });
    }

    const orderBy =
      sortBy === "visitCount"
        ? ({ checkIns: { _count: sortOrder } } as const)
        : ({ [sortBy]: sortOrder } as { name?: "asc" | "desc"; state?: "asc" | "desc"; city?: "asc" | "desc"; createdAt?: "asc" | "desc" });

    const [attractions, total] = await Promise.all([
      prisma.attraction.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          attractionCategories: { include: { category: true } },
          _count: { select: { checkIns: true } },
        },
      }),
      prisma.attraction.count({ where }),
    ]);

    const ids = attractions.map((a) => a.id);
    const ratingStats = ids.length
      ? await prisma.checkIn.groupBy({
          by: ["attractionId"],
          _avg: { rating: true },
          _count: { id: true },
          where: { attractionId: { in: ids }, rating: { not: null } },
        })
      : [];
    const ratingByAttraction: Record<string, { avg: number; count: number }> = {};
    for (const s of ratingStats) {
      ratingByAttraction[s.attractionId] = {
        avg: s._avg.rating != null ? Math.round(s._avg.rating * 10) / 10 : 0,
        count: s._count.id,
      };
    }

    const items = attractions.map((a) => {
      const { city, state } = resolveCityState(a.city, a.state, a.address);
      const dist =
        hasUserLocation && a.latitude != null && a.longitude != null
          ? distanceMiles(userLat!, userLng!, a.latitude, a.longitude)
          : null;
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        city,
        state,
        latitude: a.latitude?.toString(),
        longitude: a.longitude?.toString(),
        imageUrl: a.imageUrl ?? undefined,
        sourceUrl: a.sourceUrl,
        visitCount: a._count.checkIns,
        avgRating: ratingByAttraction[a.id]?.avg ?? null,
        ratingCount: ratingByAttraction[a.id]?.count ?? 0,
        categories: a.attractionCategories.map((ac) => ac.category).sort((a, b) => a.name.localeCompare(b.name)),
        ...(dist != null && { distanceMiles: dist }),
      };
    });

    return reply.send({ items, total, page, limit });
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const { id } = request.params;
    const attraction = await prisma.attraction.findUnique({
      where: { id },
      include: {
        attractionCategories: { include: { category: true } },
        _count: { select: { checkIns: true, photos: true } },
        checkIns: {
          take: 50,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } },
            photos: { take: 3 },
          },
        },
      },
    });
    if (!attraction) return reply.status(404).send({ error: "Attraction not found" });

    const ratingAgg = await prisma.checkIn.aggregate({
      where: { attractionId: id, rating: { not: null } },
      _avg: { rating: true },
      _count: { id: true },
    });
    const avgRating =
      ratingAgg._avg.rating != null ? Math.round(ratingAgg._avg.rating * 10) / 10 : null;
    const ratingCount = ratingAgg._count.id;

    const checkInIds = attraction.checkIns.map((c) => c.id);
    const likeCounts =
      checkInIds.length > 0
        ? await prisma.like.groupBy({
            by: ["targetId"],
            where: { targetType: "review", targetId: { in: checkInIds } },
            _count: { id: true },
          })
        : [];
    const likeCountByCheckIn: Record<string, number> = {};
    for (const g of likeCounts) {
      likeCountByCheckIn[g.targetId] = g._count.id;
    }

    const withLikeCount = attraction.checkIns.map((c) => ({
      ...c,
      likeCount: likeCountByCheckIn[c.id] ?? 0,
    }));
    const recentCheckIns = withLikeCount.slice(0, 20);
    const popularCheckIns = [...withLikeCount]
      .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
      .slice(0, 20);

    const categories = attraction.attractionCategories
      .map((ac) => ac.category)
      .sort((a, b) => a.name.localeCompare(b.name));
    const { attractionCategories, checkIns: _checkIns, ...rest } = attraction;
    const { city, state } = resolveCityState(rest.city, rest.state, rest.address);
    return reply.send({
      ...rest,
      city,
      state,
      latitude: rest.latitude?.toString(),
      longitude: rest.longitude?.toString(),
      categories,
      visitCount: attraction._count.checkIns,
      photoCount: attraction._count.photos,
      avgRating,
      ratingCount,
      recentCheckIns,
      popularCheckIns,
    });
  });

  app.get("/nearby/explore", async (request: FastifyRequest, reply: FastifyReply) => {
    const q = querySchema.safeParse(request.query);
    if (!q.success) {
      return reply.status(400).send({ error: q.error.flatten() });
    }
    const { lat, lng, limit, radiusMiles } = q.data;
    if (!lat || !lng) {
      return reply.status(400).send({ error: "lat and lng required for nearby" });
    }
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    // Bounding box then filter by haversine so results are within radius
    const dLat = radiusMiles / 69;
    const dLng = radiusMiles / (69 * Math.cos((latNum * Math.PI) / 180));
    const attractions = await prisma.attraction.findMany({
      where: {
        latitude: { gte: latNum - dLat, lte: latNum + dLat },
        longitude: { gte: lngNum - dLng, lte: lngNum + dLng },
      },
      include: {
        attractionCategories: { include: { category: true } },
        _count: { select: { checkIns: true } },
      },
    });
    const withDistance = attractions
      .filter((a) => a.latitude != null && a.longitude != null)
      .map((a) => ({
        attraction: a,
        distanceMiles: distanceMiles(latNum, lngNum, a.latitude!, a.longitude!),
      }))
      .filter((x) => x.distanceMiles <= radiusMiles)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, limit);
    const ids = withDistance.map((x) => x.attraction.id);
    const ratingStats = ids.length
      ? await prisma.checkIn.groupBy({
          by: ["attractionId"],
          _avg: { rating: true },
          _count: { id: true },
          where: { attractionId: { in: ids }, rating: { not: null } },
        })
      : [];
    const ratingByAttraction: Record<string, { avg: number; count: number }> = {};
    for (const s of ratingStats) {
      ratingByAttraction[s.attractionId] = {
        avg: s._avg.rating != null ? Math.round(s._avg.rating * 10) / 10 : 0,
        count: s._count.id,
      };
    }
    const items = withDistance.map(({ attraction: a, distanceMiles: d }) => {
      const { city, state } = resolveCityState(a.city, a.state, a.address);
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        city,
        state,
        latitude: a.latitude?.toString(),
        longitude: a.longitude?.toString(),
        imageUrl: a.imageUrl ?? undefined,
        sourceUrl: a.sourceUrl,
        visitCount: a._count.checkIns,
        avgRating: ratingByAttraction[a.id]?.avg ?? null,
        ratingCount: ratingByAttraction[a.id]?.count ?? 0,
        categories: a.attractionCategories.map((ac) => ac.category).sort((a, b) => a.name.localeCompare(b.name)),
        distanceMiles: d,
      };
    });
    return reply.send({ items });
  });
}
