import { readdir, readFile } from "node:fs/promises";
import process from "node:process";

const templateMode = process.argv.includes("--template");
const configPath = new URL("../wrangler.cloudflare.json", import.meta.url);
const sitesPath = new URL("../.openai/hosting.json", import.meta.url);
const migrationsPath = new URL("../drizzle/", import.meta.url);

const config = JSON.parse(await readFile(configPath, "utf8"));
const sites = JSON.parse(await readFile(sitesPath, "utf8"));
const migrations = (await readdir(migrationsPath)).filter((file) =>
  /^\d{4}_.+\.sql$/.test(file),
);

const errors = [];
const placeholders = [];
const expectedBindings = {
  assets: config.assets?.binding,
  database: config.d1_databases?.[0]?.binding,
  images: config.images?.binding,
  storage: config.r2_buckets?.[0]?.binding,
};

if (expectedBindings.database !== "DB") errors.push("D1 binding 必须是 DB");
if (expectedBindings.storage !== "BUCKET") errors.push("R2 binding 必须是 BUCKET");
if (expectedBindings.assets !== "ASSETS") errors.push("Assets binding 必须是 ASSETS");
if (expectedBindings.images !== "IMAGES") errors.push("Images binding 必须是 IMAGES");
if (config.d1_databases?.[0]?.migrations_dir !== "drizzle") {
  errors.push("D1 migrations_dir 必须指向 drizzle");
}
if (config.vars?.AUTH_PROVIDER !== "cloudflare-access") {
  errors.push("AUTH_PROVIDER 必须是 cloudflare-access");
}
if (sites.d1 !== "DB" || sites.r2 !== "BUCKET") {
  errors.push(".openai/hosting.json 的 Sites 绑定已被破坏");
}
if (migrations.length === 0) errors.push("没有找到 D1 SQL 迁移文件");

const valuesToReplace = [
  ["D1 database_id", config.d1_databases?.[0]?.database_id],
  ["R2 bucket_name", config.r2_buckets?.[0]?.bucket_name],
  ["Access TEAM_DOMAIN", config.vars?.TEAM_DOMAIN],
  ["Access POLICY_AUD", config.vars?.POLICY_AUD],
];
for (const [label, value] of valuesToReplace) {
  if (
    !value ||
    value.includes("replace-with-") ||
    value === "00000000-0000-4000-8000-000000000000"
  ) {
    placeholders.push(label);
  }
}

if (errors.length) {
  console.error("Cloudflare 配置结构检查失败：");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`配置结构有效；检测到 ${migrations.length} 个 D1 迁移文件。`);
if (placeholders.length) {
  const message = `仍需替换：${placeholders.join("、")}`;
  if (!templateMode) {
    console.error(message);
    process.exit(2);
  }
  console.log(`${message}（模板模式允许）`);
} else {
  console.log("独立部署必填配置已经就绪。");
}
