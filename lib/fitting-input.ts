export function cleanFittingText(
  value: unknown,
  maxLength: number,
): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeFittingDateTime(
  value: unknown,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function fittingInteger(
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

export function fittingCode(
  lookNumber: string,
  round: number,
  now = new Date(),
): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const look = lookNumber
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18)
    .toUpperCase();
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 4);
  return [
    "FIT",
    date,
    look || suffix.toUpperCase(),
    `S${String(round).padStart(2, "0")}`,
  ].join("-");
}

export function fittingApiError(
  error: unknown,
  fallback: string,
): Response {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "试身审版数据库尚未初始化，请完成新版部署后再试。"
        : message.includes("Cloudflare R2 binding")
          ? "试身影像存储暂时不可用，请检查图片存储配置。"
          : message.includes("UNIQUE constraint failed")
            ? "该技术包的试身轮次已存在，请建立下一轮试身。"
            : fallback,
    },
    { status: 500 },
  );
}
