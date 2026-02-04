import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

const createBody = z.object({
  attractionId: z.string().uuid(),
  rating: z.number().min(1).max(5).multipleOf(0.5).optional(), // 1, 1.5, 2, … 5
  review: z.string().max(5000).optional(),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const updateBody = z.object({
  rating: z.union([z.number().min(1).max(5).multipleOf(0.5), z.null()]).optional(),
  review: z.string().max(5000).optional(),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function checkInsRoutes(app: FastifyInstance) {
  const auth = [app.authenticate];

  app.post("/", { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
    const body = createBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }
    const { attractionId, rating, review, visitDate } = body.data;
    const attraction = await prisma.attraction.findUnique({ where: { id: attractionId } });
    if (!attraction) return reply.status(404).send({ error: "Attraction not found" });

    const checkIn = await prisma.checkIn.create({
      data: {
        userId,
        attractionId,
        rating: rating ?? null,
        review: review ?? null,
        visitDate: new Date(visitDate),
      },
      include: {
        attraction: { select: { id: true, name: true, city: true, state: true } },
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
    return reply.status(201).send(checkIn);
  });

  app.get("/me", { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
    const checkIns = await prisma.checkIn.findMany({
      where: { userId },
      orderBy: { visitDate: "desc" },
      include: {
        attraction: { select: { id: true, name: true, city: true, state: true, imageUrl: true } },
        photos: true,
      },
    });
    return reply.send({ items: checkIns });
  });

  app.patch("/:id", { preHandler: auth }, async (request: FastifyRequest<{ Params?: { id?: string } }>, reply: FastifyReply) => {
    const { userId } = await requireAuth(request, reply);
    const checkInId = request.params?.id;
    if (!checkInId) return reply.status(400).send({ error: "Check-in ID required" });
    const body = updateBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }
    const existing = await prisma.checkIn.findUnique({ where: { id: checkInId } });
    if (!existing) return reply.status(404).send({ error: "Check-in not found" });
    if (existing.userId !== userId) return reply.status(403).send({ error: "Not allowed to update this check-in" });
    const data: { rating?: number | null; review?: string; visitDate?: Date } = {};
    if (body.data.rating !== undefined) data.rating = body.data.rating;
    if (body.data.review !== undefined) data.review = body.data.review ?? null;
    if (body.data.visitDate !== undefined) data.visitDate = new Date(body.data.visitDate);
    const updated = await prisma.checkIn.update({
      where: { id: checkInId },
      data,
      include: {
        attraction: { select: { id: true, name: true, city: true, state: true, imageUrl: true } },
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
    return reply.send(updated);
  });

  /** Like a review (check-in) */
  app.post<{ Params: { id: string } }>(
    "/:id/like",
    { preHandler: auth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { userId } = await requireAuth(request, reply);
      const { id: checkInId } = request.params;
      const checkIn = await prisma.checkIn.findUnique({ where: { id: checkInId } });
      if (!checkIn) return reply.status(404).send({ error: "Check-in not found" });
      await prisma.like.upsert({
        where: {
          userId_targetId_targetType: { userId, targetId: checkInId, targetType: "review" },
        },
        create: { userId, targetId: checkInId, targetType: "review" },
        update: {},
      });
      const count = await prisma.like.count({
        where: { targetId: checkInId, targetType: "review" },
      });
      return reply.send({ liked: true, likeCount: count });
    }
  );

  /** Unlike a review (check-in) */
  app.delete<{ Params: { id: string } }>(
    "/:id/like",
    { preHandler: auth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { userId } = await requireAuth(request, reply);
      const { id: checkInId } = request.params;
      await prisma.like.deleteMany({
        where: { userId, targetId: checkInId, targetType: "review" },
      });
      const count = await prisma.like.count({
        where: { targetId: checkInId, targetType: "review" },
      });
      return reply.send({ liked: false, likeCount: count });
    }
  );

  /** List comments on a check-in */
  app.get<{ Params: { id: string } }>(
    "/:id/comments",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id: checkInId } = request.params;
      const checkIn = await prisma.checkIn.findUnique({ where: { id: checkInId } });
      if (!checkIn) return reply.status(404).send({ error: "Check-in not found" });
      const comments = await prisma.comment.findMany({
        where: { checkInId },
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

  /** Add comment on a check-in */
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/:id/comments",
    { preHandler: auth },
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) => {
      const { userId } = await requireAuth(request, reply);
      const { id: checkInId } = request.params;
      const body = z.object({ text: z.string().min(1).max(2000) }).safeParse(request.body);
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
      const checkIn = await prisma.checkIn.findUnique({ where: { id: checkInId } });
      if (!checkIn) return reply.status(404).send({ error: "Check-in not found" });
      const comment = await prisma.comment.create({
        data: { userId, checkInId, text: body.data.text.trim() },
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

  /** Delete own comment on a check-in */
  app.delete<{ Params: { id: string; commentId: string } }>(
    "/:id/comments/:commentId",
    { preHandler: auth },
    async (
      request: FastifyRequest<{ Params: { id: string; commentId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = await requireAuth(request, reply);
      const { commentId } = request.params;
      const comment = await prisma.comment.findUnique({ where: { id: commentId } });
      if (!comment) return reply.status(404).send({ error: "Comment not found" });
      if (comment.userId !== userId) return reply.status(403).send({ error: "Not allowed to delete this comment" });
      await prisma.comment.delete({ where: { id: commentId } });
      return reply.status(204).send();
    }
  );
}
