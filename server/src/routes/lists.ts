import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, getOptionalUserId } from "../lib/auth.js";
import { resolveCityState } from "../lib/address.js";

const createListBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  public: z.boolean().optional().default(true),
});

const addItemBody = z.object({
  attractionId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
  position: z.number().int().min(0).optional(),
});

const commentBody = z.object({
  text: z.string().min(1).max(2000),
});

export async function listsRoutes(app: FastifyInstance) {
  const auth = [app.authenticate];

  /** List my lists */
  app.get("/", { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = await requireAuth(
      request as FastifyRequest<{ Params?: Record<string, string> }>,
      reply
    );
    const lists = await prisma.list.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { listItems: true } },
      },
    });
    const items = lists.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      public: l.public,
      createdAt: l.createdAt,
      itemCount: l._count.listItems,
    }));
    return reply.send({ items });
  });

  /** Create list */
  app.post("/", { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = await requireAuth(
      request as FastifyRequest<{ Params?: Record<string, string> }>,
      reply
    );
    const body = createListBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const list = await prisma.list.create({
      data: {
        userId,
        title: body.data.title,
        description: body.data.description ?? null,
        public: body.data.public,
      },
    });
    return reply.status(201).send(list);
  });

  /** Get single list with items — public lists viewable by anyone; private require owner */
  app.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const list = await prisma.list.findUnique({
        where: { id },
        include: {
          listItems: {
            orderBy: { position: "asc" },
            include: {
              attraction: {
                include: {
                  attractionCategories: { include: { category: true } },
                  _count: { select: { checkIns: true } },
                },
              },
            },
          },
        },
      });
      if (!list) return reply.status(404).send({ error: "List not found" });
      if (!list.public) {
        try {
          const { userId } = await requireAuth(
            request as FastifyRequest<{ Params?: Record<string, string> }>,
            reply
          );
          if (userId !== list.userId) return reply.status(403).send({ error: "Not allowed to view this list" });
        } catch {
          return reply.status(401).send({ error: "Unauthorized" });
        }
      }

      const ratingStats =
        list.listItems.length > 0
          ? await prisma.checkIn.groupBy({
              by: ["attractionId"],
              _avg: { rating: true },
              _count: { id: true },
              where: {
                attractionId: { in: list.listItems.map((i) => i.attractionId) },
                rating: { not: null },
              },
            })
          : [];
      const ratingByAttraction: Record<string, { avg: number; count: number }> = {};
      for (const s of ratingStats) {
        ratingByAttraction[s.attractionId] = {
          avg: s._avg.rating != null ? Math.round(s._avg.rating * 10) / 10 : 0,
          count: s._count.id,
        };
      }

      const items = list.listItems.map((li) => {
        const a = li.attraction;
        const { city, state } = resolveCityState(a.city, a.state, a.address);
        return {
          id: li.id,
          attractionId: a.id,
          position: li.position,
          notes: li.notes,
          attraction: {
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
            categories: a.attractionCategories.map((ac) => ac.category),
          },
        };
      });

      const likeCount = await prisma.like.count({
        where: { targetId: list.id, targetType: "list" },
      });
      const userId = await getOptionalUserId(request);
      let likedByMe = false;
      if (userId) {
        const myLike = await prisma.like.findUnique({
          where: {
            userId_targetId_targetType: { userId, targetId: list.id, targetType: "list" },
          },
        });
        likedByMe = !!myLike;
      }

      return reply.send({
        id: list.id,
        title: list.title,
        description: list.description,
        public: list.public,
        createdAt: list.createdAt,
        items,
        likeCount,
        likedByMe,
      });
    }
  );

  /** Like a list */
  app.post<{ Params: { id: string } }>(
    "/:id/like",
    { preHandler: auth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { userId } = await requireAuth(request, reply);
      const { id: listId } = request.params;
      const list = await prisma.list.findUnique({ where: { id: listId } });
      if (!list) return reply.status(404).send({ error: "List not found" });
      if (!list.public) return reply.status(403).send({ error: "Cannot like a private list" });
      await prisma.like.upsert({
        where: {
          userId_targetId_targetType: { userId, targetId: listId, targetType: "list" },
        },
        create: { userId, targetId: listId, targetType: "list" },
        update: {},
      });
      const count = await prisma.like.count({
        where: { targetId: listId, targetType: "list" },
      });
      return reply.send({ liked: true, likeCount: count });
    }
  );

  /** Unlike a list */
  app.delete<{ Params: { id: string } }>(
    "/:id/like",
    { preHandler: auth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { userId } = await requireAuth(request, reply);
      const { id: listId } = request.params;
      await prisma.like.deleteMany({
        where: { userId, targetId: listId, targetType: "list" },
      });
      const count = await prisma.like.count({
        where: { targetId: listId, targetType: "list" },
      });
      return reply.send({ liked: false, likeCount: count });
    }
  );

  /** List comments on a list */
  app.get<{ Params: { id: string } }>(
    "/:id/comments",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id: listId } = request.params;
      const list = await prisma.list.findUnique({ where: { id: listId } });
      if (!list) return reply.status(404).send({ error: "List not found" });
      if (!list.public) {
        try {
          const { userId } = await requireAuth(
            request as FastifyRequest<{ Params?: Record<string, string> }>,
            reply
          );
          if (userId !== list.userId) return reply.status(403).send({ error: "Not allowed to view this list" });
        } catch {
          return reply.status(401).send({ error: "Unauthorized" });
        }
      }
      const comments = await prisma.listComment.findMany({
        where: { listId },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      });
      const items = comments.map((c) => ({
        id: c.id,
        text: c.text,
        createdAt: c.createdAt,
        user: c.user,
      }));
      return reply.send({ items });
    }
  );

  /** Add comment on a list */
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/:id/comments",
    { preHandler: auth },
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) => {
      const { userId } = await requireAuth(request, reply);
      const { id: listId } = request.params;
      const body = commentBody.safeParse(request.body);
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
      const list = await prisma.list.findUnique({ where: { id: listId } });
      if (!list) return reply.status(404).send({ error: "List not found" });
      if (!list.public) return reply.status(403).send({ error: "Cannot comment on a private list" });
      const comment = await prisma.listComment.create({
        data: { userId, listId, text: body.data.text.trim() },
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      });
      return reply.status(201).send({
        id: comment.id,
        text: comment.text,
        createdAt: comment.createdAt,
        user: comment.user,
      });
    }
  );

  /** Delete own comment on a list */
  app.delete<{ Params: { id: string; commentId: string } }>(
    "/:id/comments/:commentId",
    { preHandler: auth },
    async (
      request: FastifyRequest<{ Params: { id: string; commentId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = await requireAuth(request, reply);
      const { commentId } = request.params;
      const comment = await prisma.listComment.findUnique({ where: { id: commentId } });
      if (!comment) return reply.status(404).send({ error: "Comment not found" });
      if (comment.userId !== userId) return reply.status(403).send({ error: "Not allowed to delete this comment" });
      await prisma.listComment.delete({ where: { id: commentId } });
      return reply.status(204).send();
    }
  );

  /** Update list */
  app.patch<{ Params: { id: string }; Body: unknown }>(
    "/:id",
    { preHandler: auth },
    async (request, reply) => {
      const { userId } = await requireAuth(
        request as FastifyRequest<{ Params?: Record<string, string> }>,
        reply
      );
      const { id } = request.params;
      const body = createListBody.partial().safeParse(request.body);
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
      const list = await prisma.list.findFirst({ where: { id, userId } });
      if (!list) return reply.status(404).send({ error: "List not found" });
      const updated = await prisma.list.update({
        where: { id },
        data: {
          ...(body.data.title != null && { title: body.data.title }),
          ...(body.data.description !== undefined && { description: body.data.description }),
          ...(body.data.public !== undefined && { public: body.data.public }),
        },
      });
      return reply.send(updated);
    }
  );

  /** Delete list */
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: auth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { userId } = await requireAuth(
        request as FastifyRequest<{ Params?: Record<string, string> }>,
        reply
      );
      const { id } = request.params;
      const list = await prisma.list.findFirst({ where: { id, userId } });
      if (!list) return reply.status(404).send({ error: "List not found" });
      await prisma.list.delete({ where: { id } });
      return reply.status(204).send();
    }
  );

  /** Add attraction to list */
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/:id/items",
    { preHandler: auth },
    async (request, reply) => {
      const { userId } = await requireAuth(
        request as FastifyRequest<{ Params?: Record<string, string> }>,
        reply
      );
      const { id: listId } = request.params;
      const body = addItemBody.safeParse(request.body);
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
      const list = await prisma.list.findFirst({ where: { id: listId, userId } });
      if (!list) return reply.status(404).send({ error: "List not found" });
      const attraction = await prisma.attraction.findUnique({ where: { id: body.data.attractionId } });
      if (!attraction) return reply.status(404).send({ error: "Attraction not found" });
      const maxPos = await prisma.listItem
        .aggregate({ where: { listId }, _max: { position: true } })
        .then((r) => r._max.position ?? -1);
      const position = body.data.position ?? maxPos + 1;
      const item = await prisma.listItem.upsert({
        where: {
          listId_attractionId: { listId, attractionId: body.data.attractionId },
        },
        create: {
          listId,
          attractionId: body.data.attractionId,
          notes: body.data.notes ?? null,
          position,
        },
        update: { notes: body.data.notes ?? undefined, position },
        include: {
          attraction: { select: { id: true, name: true, city: true, state: true } },
        },
      });
      return reply.status(201).send(item);
    }
  );

  /** Remove attraction from list */
  app.delete<{ Params: { id: string; attractionId: string } }>(
    "/:id/items/:attractionId",
    { preHandler: auth },
    async (
      request: FastifyRequest<{ Params: { id: string; attractionId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = await requireAuth(
        request as FastifyRequest<{ Params?: Record<string, string> }>,
        reply
      );
      const { id: listId, attractionId } = request.params;
      const list = await prisma.list.findFirst({ where: { id: listId, userId } });
      if (!list) return reply.status(404).send({ error: "List not found" });
      await prisma.listItem.deleteMany({
        where: { listId, attractionId },
      });
      return reply.status(204).send();
    }
  );
}
