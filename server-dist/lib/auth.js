import bcrypt from "bcryptjs";
const SALT_ROUNDS = 10;
export async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}
export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
export async function requireAuth(request, reply) {
    try {
        await request.jwtVerify();
        const payload = request.user;
        return { userId: payload.sub };
    }
    catch {
        reply.status(401).send({ error: "Unauthorized" });
        throw new Error("Unauthorized");
    }
}
/** Get current user id if authenticated, without sending 401. */
export async function getOptionalUserId(request) {
    try {
        await request.jwtVerify();
        const payload = request.user;
        return payload.sub;
    }
    catch {
        return null;
    }
}
