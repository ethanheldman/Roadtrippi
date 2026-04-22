#!/usr/bin/env node
/**
 * Copies server/dist to <repo-root>/server-dist so the Vercel API function can load
 * the compiled app. This used to live at api/server-dist, but Vercel Hobby caps
 * each deploy at 12 Serverless Functions and auto-detects every .js under /api/
 * as its own function — which meant adding new server modules pushed the count
 * over the limit. Keep it at repo root; vercel.json pulls it into the function
 * bundle via `includeFiles`.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "server", "dist");
const dest = path.join(root, "server-dist");

if (!fs.existsSync(src)) {
  try {
    execSync("npm run build", { cwd: path.join(root, "server"), stdio: "inherit" });
  } catch (e) {
    console.error("Error: server build failed. Run 'cd server && npx tsc' to see errors.");
    process.exit(1);
  }
}
if (!fs.existsSync(src)) {
  console.error("Error: server/dist still not found at " + src);
  process.exit(1);
}

try {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
} catch (err) {
  console.error("Copy failed:", err.message);
  process.exit(1);
}
