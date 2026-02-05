import path from "path";
import fs from "fs";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { put } from "@vercel/blob";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

// Use same base as app.ts so static files are served from where we write (important for Vercel /tmp)
const isVercel = typeof process.env.VERCEL !== "undefined";
const AVATAR_DIR = isVercel
  ? path.join("/tmp", "uploads", "avatars")
  : path.join(process.cwd(), "uploads", "avatars");
try {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
} catch {
  // Ignore if read-only (e.g. serverless)
}
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const updateMeBody = z.object({
  // Allow full URLs or relative paths (e.g. /uploads/avatars/xxx.jpg) so saved profile keeps upload path
  avatarUrl: z
    .preprocess(
      (v) => (v === "" ? null : v),
      z
        .string()
        .max(2000)
        .refine((s) => s.startsWith("/") || s.startsWith("http://") || s.startsWith("https://"), "Must be a URL or path")
        .optional()
        .nullable()
    ),
  bio: z.preprocess((v) => (v === "" ? null : v), z.string().max(500).optional().nullable()),
  location: z.preprocess((v) => (v === "" ? null : v), z.string().max(200).optional().nullable()),
});

const userSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  bio: true,
  location: true,
  createdAt: true,
};

export async function usersRoutes(app: FastifyInstance) {
  const auth = [app.authenticate];

  // --- List users (discover) - must be before /:id ---
  app.get<{ Querystring: { page?: string; limit?: string; search?: string } }>(
    "/",
    async (request, reply) => {
      const page = Math.max(1, parseInt(request.query.page ?? "1", 10));
      const limit = Math.min(50, Math.max(1, parseInt(request.query.limit ?? "20", 10)));
      const search = request.query.search?.trim();
      const skip = (page - 1) * limit;
      const where = search
        ? { username: { contains: search } }
        : {};
      const [items, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { username: "asc" },
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            bio: true,
            location: true,
            createdAt: true,
            _count: { select: { checkIns: true, followers: true } },
          },
        }),
        prisma.user.count({ where }),
      ]);
      const usersList = items.map((u) => {
        const { _count, ...rest } = u;
        return { ...rest, checkInCount: _count.checkIns, followersCount: _count.followers };
      });
      return reply.send({ items: usersList, total, page, limit });
    }
  );

  // --- Upload avatar (multipart) ---
  app.post("/me/avatar", { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
    const req = request as unknown as {
      isMultipart: () => boolean;
      file: () => Promise<{ mimetype: string; filename: string; toBuffer: () => Promise<Buffer> } | undefined>;
    };
    if (!req.isMultipart()) {
      return reply.status(400).send({ error: "No file uploaded. Choose a JPEG, PNG, or WebP image." });
    }
    const part = await req.file();
    if (!part) {
      return reply.status(400).send({ error: "No file uploaded. Choose a JPEG, PNG, or WebP image." });
    }
    const mimetype = part.mimetype;
    if (!ALLOWED_TYPES.has(mimetype)) {
      return reply.status(400).send({ error: "Invalid file type. Use JPEG, PNG, or WebP." });
    }
    const ext = EXT_BY_MIME[mimetype] ?? "jpg";
    const buffer = await part.toBuffer();
    if (!buffer || buffer.length === 0) {
      return reply.status(400).send({ error: "Uploaded file is empty. Choose a valid image." });
    }

    let avatarUrl: string;
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      try {
        const pathname = `avatars/${userId}.${ext}`;
        const blob = await put(pathname, buffer, {
          access: "public",
          contentType: mimetype,
          token: blobToken,
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        avatarUrl = blob.url;
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: "Failed to upload image" });
      }
    } else {
      const filename = `${userId}.${ext}`;
      const dest = path.join(AVATAR_DIR, filename);
      try {
        fs.writeFileSync(dest, buffer);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: "Failed to save image" });
      }
      avatarUrl = `/uploads/avatars/${filename}`;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { avatarUrl: true },
    });
    return reply.send({ avatarUrl });
  });

  // --- Update my profile (avatar, bio, location) ---
  app.patch("/me", { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
    const body = updateMeBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const data: { avatarUrl?: string | null; bio?: string | null; location?: string | null } = {};
    if (body.data.avatarUrl !== undefined) data.avatarUrl = body.data.avatarUrl;
    if (body.data.bio !== undefined) data.bio = body.data.bio;
    if (body.data.location !== undefined) data.location = body.data.location;
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, email: true, avatarUrl: true, bio: true, location: true, createdAt: true },
    });
    return reply.send(user);
  });

  // --- Authenticated "me" follow/friend routes (must come before /:id) ---
  app.get("/me/social", { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.follow.count({ where: { followerId: userId } }),
    ]);
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    const friendsCount = await prisma.follow.count({
      where: {
        followerId: { in: followingIds },
        followingId: userId,
      },
    });
    return reply.send({ followersCount, followingCount, friendsCount });
  });

  app.get("/me/followers", { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
    const rows = await prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: { select: userSelect } },
    });
    return reply.send({ items: rows.map((r) => r.follower) });
  });

  app.get("/me/following", { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
    const rows = await prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: { select: userSelect } },
    });
    return reply.send({ items: rows.map((r) => r.following) });
  });

  /** Friends = mutual follows (they follow you and you follow them) */
  app.get("/me/friends", { preHandler: auth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    const mutual = await prisma.follow.findMany({
      where: {
        followerId: { in: followingIds },
        followingId: userId,
      },
      include: { follower: { select: userSelect } },
    });
    return reply.send({ items: mutual.map((m) => m.follower) });
  });

  /** Recent check-ins from people you follow (for home feed) */
  app.get<{ Querystring: { limit?: string } }>(
    "/me/feed",
    { preHandler: auth },
    async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
      const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
      const limit = Math.min(50, Math.max(1, parseInt(request.query.limit ?? "30", 10)));
      const following = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });
      const followingIds = following.map((f) => f.followingId);
      if (followingIds.length === 0) {
        return reply.send({ items: [] });
      }
      const checkIns = await prisma.checkIn.findMany({
        where: { userId: { in: followingIds } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          attraction: { select: { id: true, name: true, city: true, state: true, imageUrl: true } },
        },
      });
      const checkInIds = checkIns.map((c) => c.id);
      const [likeCounts, myLikes] = await Promise.all([
        checkInIds.length > 0
          ? prisma.like.groupBy({
              by: ["targetId"],
              where: { targetId: { in: checkInIds }, targetType: "review" },
              _count: { id: true },
            })
          : [],
        prisma.like.findMany({
          where: { userId, targetId: { in: checkInIds }, targetType: "review" },
          select: { targetId: true },
        }),
      ]);
      const likeCountByCheckIn: Record<string, number> = {};
      for (const g of likeCounts) {
        likeCountByCheckIn[g.targetId] = g._count.id;
      }
      const likedSet = new Set(myLikes.map((l) => l.targetId));
      const items = checkIns.map((c) => ({
        ...c,
        likeCount: likeCountByCheckIn[c.id] ?? 0,
        likedByMe: likedSet.has(c.id),
      }));
      return reply.send({ items });
    }
  );

  /** Inbox: likes and comments on my reviews and lists */
  app.get<{ Querystring: { limit?: string } }>(
    "/me/inbox",
    { preHandler: auth },
    async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
      const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? "50", 10)));

      const [myCheckIns, myLists] = await Promise.all([
        prisma.checkIn.findMany({ where: { userId }, select: { id: true } }),
        prisma.list.findMany({ where: { userId }, select: { id: true } }),
      ]);
      const myCheckInIds = myCheckIns.map((c) => c.id);
      const myListIds = myLists.map((l) => l.id);

      const [likesReview, likesList, commentsReview, commentsList, followsOfMe] = await Promise.all([
        myCheckInIds.length > 0
          ? prisma.like.findMany({
              where: {
                targetType: "review",
                targetId: { in: myCheckInIds },
                userId: { not: userId },
              },
              include: { user: { select: { id: true, username: true, avatarUrl: true } } },
              orderBy: { createdAt: "desc" },
            })
          : [],
        myListIds.length > 0
          ? prisma.like.findMany({
              where: {
                targetType: "list",
                targetId: { in: myListIds },
                userId: { not: userId },
              },
              include: { user: { select: { id: true, username: true, avatarUrl: true } } },
              orderBy: { createdAt: "desc" },
            })
          : [],
        myCheckInIds.length > 0
          ? prisma.comment.findMany({
              where: { checkInId: { in: myCheckInIds }, userId: { not: userId } },
              include: {
                user: { select: { id: true, username: true, avatarUrl: true } },
                checkIn: { include: { attraction: { select: { id: true, name: true } } } },
              },
              orderBy: { createdAt: "desc" },
            })
          : [],
        myListIds.length > 0
          ? prisma.listComment.findMany({
              where: { listId: { in: myListIds }, userId: { not: userId } },
              include: {
                user: { select: { id: true, username: true, avatarUrl: true } },
                list: { select: { id: true, title: true } },
              },
              orderBy: { createdAt: "desc" },
            })
          : [],
        prisma.follow.findMany({
          where: { followingId: userId },
          include: { follower: { select: { id: true, username: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
      ]);

      type InboxItem = {
        id: string;
        type: "like_review" | "like_list" | "comment_review" | "comment_list" | "follow";
        actor: { id: string; username: string; avatarUrl: string | null };
        createdAt: string;
        checkInId?: string;
        listId?: string;
        attractionId?: string;
        attractionName?: string;
        listTitle?: string;
        commentSnippet?: string;
        rating?: number | null;
      };

      const checkInIdsFromLikes = [...new Set(likesReview.map((l) => l.targetId))];
      const listIdsFromLikes = [...new Set(likesList.map((l) => l.targetId))];
      const [checkInsWithAttraction, listsForLikes] = await Promise.all([
        checkInIdsFromLikes.length > 0
          ? prisma.checkIn.findMany({
              where: { id: { in: checkInIdsFromLikes } },
              select: { id: true, rating: true, attraction: { select: { id: true, name: true } } },
            })
          : [],
        listIdsFromLikes.length > 0
          ? prisma.list.findMany({
              where: { id: { in: listIdsFromLikes } },
              select: { id: true, title: true },
            })
          : [],
      ]);
      const checkInById = Object.fromEntries(
        checkInsWithAttraction.map((c) => [c.id, c])
      );
      const attractionByCheckInId = Object.fromEntries(
        checkInsWithAttraction.map((c) => [c.id, c.attraction])
      );
      const listById = Object.fromEntries(listsForLikes.map((l) => [l.id, l]));

      const items: InboxItem[] = [];

      for (const l of likesReview) {
        const att = attractionByCheckInId[l.targetId];
        items.push({
          id: `like-review-${l.id}`,
          type: "like_review",
          actor: l.user,
          createdAt: l.createdAt.toISOString(),
          checkInId: l.targetId,
          attractionId: att?.id,
          attractionName: att?.name,
        });
      }
      for (const l of likesList) {
        const list = listById[l.targetId];
        items.push({
          id: `like-list-${l.id}`,
          type: "like_list",
          actor: l.user,
          createdAt: l.createdAt.toISOString(),
          listId: l.targetId,
          listTitle: list?.title ?? undefined,
        });
      }
      for (const c of commentsReview) {
        const att = c.checkIn?.attraction;
        items.push({
          id: `comment-review-${c.id}`,
          type: "comment_review",
          actor: c.user,
          createdAt: c.createdAt.toISOString(),
          checkInId: c.checkInId,
          attractionId: att?.id,
          attractionName: att?.name,
          commentSnippet: c.text.slice(0, 100) + (c.text.length > 100 ? "…" : ""),
          rating: c.checkIn?.rating ?? null,
        });
      }
      for (const c of commentsList) {
        items.push({
          id: `comment-list-${c.id}`,
          type: "comment_list",
          actor: c.user,
          createdAt: c.createdAt.toISOString(),
          listId: c.listId,
          listTitle: c.list?.title ?? undefined,
          commentSnippet: c.text.slice(0, 100) + (c.text.length > 100 ? "…" : ""),
        });
      }
      for (const f of followsOfMe) {
        items.push({
          id: `follow-${f.followerId}-${f.followingId}`,
          type: "follow",
          actor: f.follower,
          createdAt: f.createdAt.toISOString(),
        });
      }

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const trimmed = items.slice(0, limit);
      return reply.send({ items: trimmed });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/:id/follow",
    { preHandler: auth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
      const { id: targetId } = request.params;
      if (targetId === userId) return reply.status(400).send({ error: "You can't follow yourself. Use another account to follow this user." });
      const target = await prisma.user.findUnique({ where: { id: targetId } });
      if (!target) return reply.status(404).send({ error: "User not found" });
      await prisma.follow.upsert({
        where: {
          followerId_followingId: { followerId: userId, followingId: targetId },
        },
        create: { followerId: userId, followingId: targetId },
        update: {},
      });
      return reply.status(201).send({ ok: true, following: true });
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/:id/follow",
    { preHandler: auth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
      const { id: targetId } = request.params;
      await prisma.follow.deleteMany({
        where: { followerId: userId, followingId: targetId },
      });
      return reply.send({ ok: true, following: false });
    }
  );

  /** Check if current user follows target (authenticated). */
  app.get<{ Params: { id: string } }>(
    "/:id/following",
    { preHandler: auth },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { userId } = await requireAuth(request as FastifyRequest<{ Params?: Record<string, string> }>, reply);
      const { id: targetId } = request.params;
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: userId, followingId: targetId },
        },
      });
      return reply.send({ following: !!follow });
    }
  );

  /** Public: list of users that this user follows */
  app.get<{ Params: { id: string } }>("/:id/following/list", async (request, reply) => {
    const { id } = request.params;
    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return reply.status(404).send({ error: "User not found" });
    const rows = await prisma.follow.findMany({
      where: { followerId: id },
      include: { following: { select: userSelect } },
    });
    const items = rows.map((r) => r.following);
    return reply.send({ items });
  });

  /** Public: list of users who follow this user */
  app.get<{ Params: { id: string } }>("/:id/followers/list", async (request, reply) => {
    const { id } = request.params;
    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return reply.status(404).send({ error: "User not found" });
    const rows = await prisma.follow.findMany({
      where: { followingId: id },
      include: { follower: { select: userSelect } },
    });
    const items = rows.map((r) => r.follower);
    return reply.send({ items });
  });

  /** Public: list of this user's public lists */
  app.get<{ Params: { id: string } }>("/:id/lists", async (request, reply) => {
    const { id } = request.params;
    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return reply.status(404).send({ error: "User not found" });
    const lists = await prisma.list.findMany({
      where: { userId: id, public: true },
      select: { id: true, title: true, description: true, public: true, createdAt: true, _count: { select: { listItems: true } } },
    });
    const items = lists.map((l) => {
      const { _count, ...rest } = l;
      return { ...rest, itemCount: _count.listItems };
    });
    return reply.send({ items });
  });

  // --- Public profile (by id) — same data shape as own profile for read-only view ---
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const { id } = request.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bio: true,
        location: true,
        createdAt: true,
        _count: { select: { checkIns: true, lists: true, followers: true, following: true } },
        checkIns: {
          take: 50,
          orderBy: { visitDate: "desc" },
          include: {
            attraction: { select: { id: true, name: true, city: true, state: true, imageUrl: true } },
            photos: { take: 1 },
          },
        },
      },
    });
    if (!user) return reply.status(404).send({ error: "User not found" });
    const { _count, checkIns, ...rest } = user;
    return reply.send({
      ...rest,
      checkInCount: _count.checkIns,
      listCount: _count.lists,
      followersCount: _count.followers,
      followingCount: _count.following,
      recentCheckIns: checkIns,
    });
  });
}
