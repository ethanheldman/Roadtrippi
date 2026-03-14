#!/usr/bin/env node
/** Runs vercel-build steps one by one so the log shows exactly which step failed. */
const { execSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");

const steps = [
  ["build:server", path.join(root, "server"), "npm run build"],
  ["copy-server-dist", root, "node scripts/copy-server-dist.cjs"],
  ["build:client", path.join(root, "client"), "npm run build"],
];

for (const [name, cwd, cmd] of steps) {
  console.log("\n=== " + name + " ===\n");
  try {
    execSync(cmd, { stdio: "inherit", cwd, shell: true });
  } catch (err) {
    console.error("\n>>> FAILED: " + name + " <<<\n");
    process.exit(1);
  }
}

console.log("\n=== vercel-build done ===\n");
