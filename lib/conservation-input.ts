export function cleanConservationText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeConservationDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function conservationInteger(value: unknown, fallback = 0) {
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

export function conservationReportCode(
  assetCode: string,
  sequence: number,
  now = new Date(),
) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const asset = assetCode
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18)
    .toUpperCase();
  return `CARE-${date}-${asset || crypto.randomUUID().slice(0, 4).toUpperCase()}-R${String(sequence).padStart(2, "0")}`;
}

export function conservationApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "作品养护数据库尚未初始化，请完成新版部署后再试。"
        : message.includes("Cloudflare R2 binding")
          ? "养护证据存储暂时不可用，请检查图片存储配置。"
          : message.includes("UNIQUE constraint failed")
            ? "该作品的养护报告轮次已经存在，请刷新后建立下一轮。"
            : fallback,
    },
    { status: 500 },
  );
}
