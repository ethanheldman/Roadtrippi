import path from "path";
import { pathToFileURL } from "url";
import { VercelRequest, VercelResponse } from "@vercel/node";

type FastifyApp = Awaited<ReturnType<typeof import("../server/dist/app.js").createApp>>;
let appInstance: FastifyApp | null = null;

async function loadCreateApp(): Promise<() => Promise<FastifyApp>> {
  // Prefer explicit path from cwd so serverless runtime finds server/dist
  const fromCwd = path.join(process.cwd(), "server", "dist", "app.js");
  try {
    const mod = await import(pathToFileURL(fromCwd).href);
    return mod.createApp;
  } catch {
    // Fallback to relative import (e.g. local dev or bundled)
    const mod = await import("../server/dist/app.js");
    return mod.createApp;
  }
}

/** Build full request URL (path + query) for Fastify inject so pagination/sort/filters work on Vercel */
function getRequestUrl(req: VercelRequest): string {
  // Rewrite sends /api/(.*) -> /api?path=$1, so path param is in query; other params (page, sortBy, etc.) are also in query
  const pathParam = req.query?.path;
  if (typeof pathParam === "string" && pathParam.length > 0) {
    const basePath = "/api/" + pathParam.replace(/\?.*/, ""); // strip any embedded query from path
    const q = { ...req.query };
    delete q.path;
    const keys = Object.keys(q).filter((k) => q[k] !== undefined && q[k] !== "");
    if (keys.length === 0) return basePath;
    const search = keys
      .map((k) => {
        const v = q[k];
        return encodeURIComponent(k) + "=" + encodeURIComponent(Array.isArray(v) ? v[0] : String(v));
      })
      .join("&");
    return basePath + "?" + search;
  }
  const raw =
    req.headers["x-request-path"] ??
    req.headers["x-invoke-path"] ??
    req.headers["x-url"] ??
    req.url;
  const path = Array.isArray(raw) ? raw[0] : raw;
  return (typeof path === "string" && path.length > 0 ? path : undefined) ?? "/api";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!appInstance) {
      const createApp = await loadCreateApp();
      appInstance = await createApp();
    }
    await appInstance.ready();

    const url = getRequestUrl(req);
    const method = (req.method ?? "GET").toUpperCase() as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v !== undefined && k.toLowerCase() !== "content-length") {
        headers[k] = Array.isArray(v) ? v.join(", ") : String(v);
      }
    }
    let payload: string | undefined;
    if (req.body !== undefined && method !== "GET" && method !== "HEAD") {
      payload = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }

    const response = (await appInstance.inject({
      method,
      url,
      headers,
      payload,
    })) as { statusCode: number; headers: Record<string, string | string[] | undefined>; payload: string | Buffer };

    res.status(response.statusCode);
    const resHeaders = response.headers;
    if (resHeaders) {
      for (const [key, value] of Object.entries(resHeaders)) {
        if (value !== undefined && typeof value !== "function") {
          const v = Array.isArray(value) ? value.join(", ") : String(value);
          res.setHeader(key, v);
        }
      }
    }
    res.send(response.payload ?? "");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("API handler error:", message, stack);
    res.status(500).json({
      error: "Internal server error",
      ...(process.env.VERCEL && { detail: message }),
    });
  }
}
