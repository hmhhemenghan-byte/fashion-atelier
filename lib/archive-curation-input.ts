export function cleanCurationText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeCurationDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function curationInteger(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : fallback;
  return Number.isFinite(parsed) ? Math.max(0, Math.min(10_000, Math.round(parsed))) : fallback;
}

export function curatorialProjectCode(now = new Date()) {
  return `CURATE-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export function curationApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return Response.json({
    error: message.includes("no such table")
      ? "档案策展数据库尚未初始化，请完成新版部署后再试。"
      : message.includes("UNIQUE constraint failed")
        ? "该策展项目已经包含这件实物，请直接修改现有选择。"
        : fallback,
  }, { status: 500 });
}
