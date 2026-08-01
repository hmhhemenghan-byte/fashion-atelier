export function cleanMaterialText(
  value: unknown,
  maxLength: number,
): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function materialCode(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6);
  return `MAT-${date}-${suffix.toUpperCase()}`;
}

export function materialSortOrder(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : 0;
  return Number.isFinite(parsed)
    ? Math.max(-9999, Math.min(9999, Math.round(parsed)))
    : 0;
}

export function materialApiError(
  error: unknown,
  fallback: string,
): Response {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "材料室数据库尚未初始化，请完成新版部署后再试。"
        : message.includes("Cloudflare R2 binding")
          ? "材料色卡存储暂时不可用，请检查图片存储配置。"
          : fallback,
    },
    { status: 500 },
  );
}
