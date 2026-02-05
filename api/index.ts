import path from "path";
import { pathToFileURL } from "url";
import { VercelRequest, VercelResponse } from "@vercel/node";
import type { FastifyInstance } from "fastify";

/** Disable body parsing so we can pass raw multipart (file upload) body to Fastify */
export const config = { api: { bodyParser: false } };

let appInstance: FastifyInstance | null = null;

/** Read raw request body from stream (required when bodyParser is false; needed for multipart uploads) */
function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function loadCreateApp(): Promise<() => Promise<FastifyInstance>> {
  // On Vercel the function runs from /var/task; server/dist is copied to api/server-dist at build time
  const paths = [
    path.join(__dirname, "server-dist", "app.js"),
    path.join(process.cwd(), "server", "dist", "app.js"),
    path.join(process.cwd(), "api", "server-dist", "app.js"),
  ];
  for (const appPath of paths) {
    try {
      const mod = await import(pathToFileURL(appPath).href);
      if (mod?.createApp) return mod.createApp;
    } catch {
      continue;
    }
  }
  throw new Error(`Could not find server app. Tried: ${paths.join(", ")}`);
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
    let payload: string | Buffer | undefined;
    if (method !== "GET" && method !== "HEAD") {
      const contentType = headers["content-type"] ?? "";
      const isMultipart = contentType.includes("multipart/form-data");
      const raw = await readRawBody(req);
      if (raw.length > 0) {
        payload = isMultipart ? raw : raw.toString("utf8");
      } else if (req.body !== undefined && !isMultipart) {
        // Fallback when platform already parsed body (e.g. JSON)
        payload = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      }
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
