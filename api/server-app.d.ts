/** Type declaration for server build output (server/dist/app.js). File may not exist at type-check time. */
declare module "../server/dist/app.js" {
  import type { FastifyInstance } from "fastify";
  export function createApp(): Promise<FastifyInstance>;
}
