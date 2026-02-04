import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/auth.js";

const registerBody = z.object({
  username: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});
const loginBody = z.object({
  username: z.string().min(1),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = registerBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }
    const { username, email, password } = body.data;
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      return reply.status(409).send({ error: "Email or username already in use" });
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, email, passwordHash },
      select: { id: true, username: true, email: true, createdAt: true },
    });
    const token = app.jwt.sign({ sub: user.id }, { expiresIn: "7d" });
    return reply.send({ user, token });
  });

  app.post("/login", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: body.error.flatten() });
      }
      const { username, password } = body.data;
      const user = await prisma.user.findUnique({ where: { username: username.trim() } });
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return reply.status(401).send({ error: "Invalid username or password" });
      }
      const token = app.jwt.sign({ sub: user.id }, { expiresIn: "7d" });
      return reply.send({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          location: user.location,
          createdAt: user.createdAt,
        },
        token,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        bio: true,
        location: true,
        createdAt: true,
        _count: { select: { checkIns: true } },
      },
    });
    if (!user) return reply.status(404).send({ error: "User not found" });
    const { _count, ...rest } = user;
    return reply.send({ ...rest, checkInCount: _count.checkIns });
  });
}
