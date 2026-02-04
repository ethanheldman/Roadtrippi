import { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../server/src/app.js";

let appInstance: Awaited<ReturnType<typeof createApp>> | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!appInstance) {
    appInstance = await createApp();
  }
  await appInstance.ready();
  appInstance.server.emit("request", req, res);
}
