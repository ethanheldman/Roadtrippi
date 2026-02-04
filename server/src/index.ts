import { createApp } from "./app.js";

// For local development (not running as Vercel serverless function)
if (!process.env.VERCEL) {
  const app = await createApp();
  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: "0.0.0.0" });
}
