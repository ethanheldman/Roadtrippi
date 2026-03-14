#!/usr/bin/env node
/** Runs vercel-build steps one by one; on failure prints the step name and full command output. */
const { execSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");

console.log("\n=== Build phase started ===");
console.log("Node:", process.version);
console.log("DATABASE_URL set:", !!process.env.DATABASE_URL);
console.log("CWD:", process.cwd());
console.log("server/dist exists:", require("fs").existsSync(path.join(root, "server", "dist")));
console.log("");

const steps = [
  ["build:server", path.join(root, "server"), "npm run build"],
  ["copy-server-dist", root, "node scripts/copy-server-dist.cjs"],
  ["build:client", path.join(root, "client"), "npm run build"],
];

for (const [name, cwd, cmd] of steps) {
  console.log("\n=== " + name + " ===\n");
  try {
    execSync(cmd, { cwd, shell: true, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  } catch (err) {
    console.error("\n>>> FAILED: " + name + " <<<");
    if (err.stdout) console.log("--- stdout ---\n" + err.stdout);
    if (err.stderr) console.error("--- stderr ---\n" + err.stderr);
    console.error("\n>>> END FAILED OUTPUT <<<\n");
    process.exit(1);
  }
  console.log("--- " + name + " OK ---");
}

console.log("\n=== vercel-build done ===\n");
