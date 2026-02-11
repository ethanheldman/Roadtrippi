import type { FastifyRequest, FastifyReply } from "fastify";
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
export declare function requireAuth(request: FastifyRequest<{
    Params?: Record<string, string>;
}>, reply: FastifyReply): Promise<{
    userId: string;
}>;
/** Get current user id if authenticated, without sending 401. */
export declare function getOptionalUserId(request: FastifyRequest): Promise<string | null>;
