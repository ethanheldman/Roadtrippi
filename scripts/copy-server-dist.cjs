#!/usr/bin/env node
/** Copies server/dist to api/server-dist for Vercel API to load. */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Resolve repo root from this script's location (scripts/copy-server-dist.cjs) so it works when cwd varies (e.g. Vercel)
const root = path.resolve(__dirname, "..");
const src = path.join(root, "server", "dist");
const dest = path.join(root, "api", "server-dist");

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
