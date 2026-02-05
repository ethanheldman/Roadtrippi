import bcrypt from "bcryptjs";
import type { FastifyRequest, FastifyReply } from "fastify";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function requireAuth(
  request: FastifyRequest<{ Params?: Record<string, string> }>,
  reply: FastifyReply
): Promise<{ userId: string }> {
  try {
    await request.jwtVerify();
    const payload = request.user as { sub: string };
    return { userId: payload.sub };
  } catch {
    reply.status(401).send({ error: "Unauthorized" });
    throw new Error("Unauthorized");
  }
}

/** Get current user id if authenticated, without sending 401. */
export async function getOptionalUserId(
  request: FastifyRequest
): Promise<string | null> {
  try {
    await request.jwtVerify();
    const payload = request.user as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}
