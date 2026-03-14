#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const steps = [
  [path.join(root, "server"), "npm run build"],
  [root, "node scripts/copy-server-dist.cjs"],
  [path.join(root, "client"), "npm run build"],
];

for (const [cwd, cmd] of steps) {
  try {
    execSync(cmd, { cwd, shell: true, encoding: "utf8", maxBuffer: 10 * 1024 * 1024, stdio: "pipe" });
  } catch (err) {
    if (err.stderr) process.stderr.write(err.stderr);
    if (err.stdout) process.stdout.write(err.stdout);
    process.exit(1);
  }
}
