import path from "path";
import fs from "fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth.js";
import { attractionsRoutes } from "./routes/attractions.js";
import { usersRoutes } from "./routes/users.js";
import { checkInsRoutes } from "./routes/check-ins.js";
import { listsRoutes } from "./routes/lists.js";
import { gameRoutes } from "./routes/game.js";
import { connectionsRoutes } from "./routes/connections.js";
import { seoRoutes } from "./routes/seo.js";

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
  await app.register(fastifyStatic, { root: uploadsDir, prefix: "/api/uploads/" });

  // T2.5: register the global rate-limit plugin but DON'T apply it by default.
  // Individual routes opt in via config.rateLimit. This keeps read-heavy
  // endpoints (listings, map data) untouched while throttling auth + writes.
  // Note: on serverless (Vercel), each cold instance has its own in-memory
  // counter, so this is best-effort defense-in-depth, not a hard cap.
  await app.register(rateLimit, { global: false });
  // B10: refuse to boot in production with the dev JWT secret fallback.
  // In dev the fallback is fine; in Vercel/prod this would silently sign tokens
  // with a publicly-guessable key, so require an explicit env var instead.
  const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-min-32-characters-long";
  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET env var is required in production");
  }
  await app.register(fjwt, { secret: jwtSecret });

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
  await app.register(gameRoutes, { prefix: "/api/game" });
  await app.register(connectionsRoutes, { prefix: "/api/connections" });

  // SEO routes — sitemap.xml, robots.txt, HTML pre-render for /attraction/:id and /best-roadside-attractions/:state
  await app.register(seoRoutes);

  return app;
}
