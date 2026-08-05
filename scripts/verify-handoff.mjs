import { readFile } from "node:fs/promises";
import process from "node:process";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run handoff:check -- <nera-full-handoff.json>");
  process.exit(64);
}

const archive = JSON.parse(await readFile(input, "utf8"));
if (!Array.isArray(archive.mediaManifest)) {
  console.error("交接包缺少 mediaManifest 数组。");
  process.exit(1);
}

const keys = new Set();
let totalBytes = 0;
for (const [index, item] of archive.mediaManifest.entries()) {
  const key = typeof item.objectKey === "string" ? item.objectKey.trim() : "";
  if (!key || key.startsWith("/") || key.split("/").includes("..")) {
    console.error(`mediaManifest[${index}] 的 objectKey 无效。`);
    process.exit(1);
  }
  if (keys.has(key)) {
    console.error(`媒体对象键重复：${key}`);
    process.exit(1);
  }
  keys.add(key);
  if (Number.isFinite(item.bytes) && item.bytes > 0) totalBytes += item.bytes;
}

console.log(
  `交接包有效：${keys.size} 个唯一 R2 对象，已记录 ${totalBytes} bytes。`,
);
