export function cleanWatchText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeWatchDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function watchInteger(value: unknown, fallback = 0, min = 0, max = 1_000_000) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : fallback;
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback;
}

export function watchTemperatureTenth(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(parsed) ? Math.round(parsed * 10) : null;
}

export function exhibitionWatchCode(planCode: string, now = new Date()) {
  const suffix = planCode.replace(/^DISPLAY-/, "").slice(0, 42);
  return `WATCH-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${suffix}`;
}

export function exhibitionWatchApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return Response.json({
    error: message.includes("no such table")
      ? "展期监测数据库尚未初始化，请完成新版部署后再试。"
      : message.includes("Cloudflare R2 binding")
        ? "展期证据存储暂时不可用，请检查图片存储配置。"
        : message.includes("UNIQUE constraint failed")
          ? "该展陈方案已经建立监测记录，请刷新页面。"
          : fallback,
  }, { status: 500 });
}
