#!/usr/bin/env node
/** Copies server/dist to api/server-dist for Vercel API to load. */
const fs = require("fs");
const path = require("path");

// Resolve repo root from this script's location (scripts/copy-server-dist.cjs) so it works when cwd varies (e.g. Vercel)
const root = path.resolve(__dirname, "..");
const src = path.join(root, "server", "dist");
const dest = path.join(root, "api", "server-dist");

if (!fs.existsSync(src)) {
  console.error("Error: server/dist not found at " + src + " (cwd=" + process.cwd() + "). Run 'cd server && npx tsc' first.");
  process.exit(1);
}

try {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log("Copied server/dist → api/server-dist");
} catch (err) {
  console.error("Copy failed:", err.message);
  process.exit(1);
}
