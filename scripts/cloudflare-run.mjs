import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const command = process.argv[2];
if (!new Set(["dev", "build"]).has(command)) {
  console.error("Usage: node scripts/cloudflare-run.mjs <dev|build>");
  process.exit(64);
}

const vite = resolve("node_modules/vite/bin/vite.js");
if (!existsSync(vite)) {
  console.error("Dependencies are missing. Run `npm ci` first.");
  process.exit(66);
}

const result = spawnSync(process.execPath, [vite, command], {
  env: {
    ...process.env,
    NERA_DEPLOY_TARGET: "cloudflare",
    WRANGLER_LOG_PATH:
      process.env.WRANGLER_LOG_PATH ?? ".wrangler/wrangler-cloudflare.log",
  },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
