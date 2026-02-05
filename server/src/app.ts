import path from "path";
import fs from "fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { authRoutes } from "./routes/auth.js";
import { attractionsRoutes } from "./routes/attractions.js";
import { usersRoutes } from "./routes/users.js";
import { checkInsRoutes } from "./routes/check-ins.js";
import { listsRoutes } from "./routes/lists.js";

// Serverless (e.g. Vercel) has read-only filesystem; use /tmp and skip mkdir if not writable
const isVercel = typeof process.env.VERCEL !== "undefined";
const uploadsDir = isVercel
  ? path.join("/tmp", "uploads")
  : path.join(process.cwd(), "uploads");
const avatarsDir = path.join(uploadsDir, "avatars");
try {
  fs.mkdirSync(avatarsDir, { recursive: true });
} catch {
  // Ignore (e.g. read-only fs); uploads will not be persisted on serverless
}

export async function createApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(fastifyStatic, { root: uploadsDir, prefix: "/uploads/" });
  await app.register(fjwt, {
    secret: process.env.JWT_SECRET ?? "dev-secret-min-32-characters-long",
  });

  app.decorate("authenticate", async function (request: { jwtVerify: () => Promise<unknown> }, reply: { status: (n: number) => { send: (o: object) => void } }) {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: "Unauthorized" });
    }
  });

  // Health
  app.get("/health", async () => ({ ok: true }));

  // API
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(attractionsRoutes, { prefix: "/api/attractions" });
  await app.register(async (child) => {
    await child.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } });
    await child.register(usersRoutes);
  }, { prefix: "/api/users" });
  await app.register(checkInsRoutes, { prefix: "/api/check-ins" });
  await app.register(listsRoutes, { prefix: "/api/lists" });

  return app;
}
