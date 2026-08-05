import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [resolve("scripts/cloudflare-preflight.mjs")]);

const vite = resolve("node_modules/vite/bin/vite.js");
const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
if (!existsSync(vite) || !existsSync(wrangler)) {
  console.error("Dependencies are missing. Run `npm ci` first.");
  process.exit(66);
}

run(process.execPath, [vite, "build"], {
  NERA_DEPLOY_TARGET: "cloudflare",
  WRANGLER_LOG_PATH: ".wrangler/wrangler-cloudflare.log",
});
// The Vite plugin writes a redirected deployment config that points at the
// compiled Worker and assets. Wrangler automatically discovers that output.
run(process.execPath, [wrangler, "deploy"]);
