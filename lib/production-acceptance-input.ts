export function cleanProductionAcceptanceText(
  value: unknown,
  maxLength: number,
): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeProductionAcceptanceDateTime(
  value: unknown,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function productionAcceptanceInteger(
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
    ? Math.max(0, Math.min(1_000_000, Math.round(parsed)))
    : fallback;
}

export function productionAcceptanceCode(
  lookNumber: string,
  sequence: number,
  now = new Date(),
): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const look = lookNumber
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18)
    .toUpperCase();
  const fallback = crypto.randomUUID().replaceAll("-", "").slice(0, 4);
  return `ACCEPT-${date}-${look || fallback.toUpperCase()}-A${String(sequence).padStart(2, "0")}`;
}

export function productionAcceptanceSeal(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
  return `NERA-ACCEPT-${date}-${suffix.toUpperCase()}`;
}

export function productionAcceptanceApiError(
  error: unknown,
  fallback: string,
): Response {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "成衣验收数据库尚未初始化，请完成新版部署后再试。"
        : message.includes("Cloudflare R2 binding")
          ? "成衣验收证据存储暂时不可用，请检查图片存储配置。"
          : message.includes("UNIQUE constraint failed")
            ? "该生产放行的验收轮次已经存在，请刷新后建立下一轮。"
            : fallback,
    },
    { status: 500 },
  );
}
