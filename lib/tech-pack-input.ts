export function cleanTechPackText(
  value: unknown,
  maxLength: number,
): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function techPackCode(
  workLookNumber: string,
  revision: number,
  now = new Date(),
): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const look = workLookNumber
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18)
    .toUpperCase();
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 4);
  return [
    "TP",
    date,
    look || suffix.toUpperCase(),
    `R${String(revision).padStart(2, "0")}`,
  ].join("-");
}

export function techPackInteger(
  value: unknown,
  fallback = 0,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : fallback;
  return Number.isFinite(parsed)
    ? Math.max(-9999, Math.min(9999, Math.round(parsed)))
    : fallback;
}

export function techPackApiError(
  error: unknown,
  fallback: string,
): Response {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "技术工艺室数据库尚未初始化，请完成新版部署后再试。"
        : message.includes("Cloudflare R2 binding")
          ? "技术图存储暂时不可用，请检查图片存储配置。"
          : message.includes("UNIQUE constraint failed")
            ? "该 Look 的修订号已存在，请建立新的修订版本。"
            : fallback,
    },
    { status: 500 },
  );
}
