export function cleanRecoveryText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeRecoveryDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function recoveryInteger(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : fallback;
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1_000_000, Math.round(parsed))) : fallback;
}

export function exhibitionRecoveryCode(watchCode: string, now = new Date()) {
  const suffix = watchCode.replace(/^WATCH-/, "").slice(0, 44);
  return `RECOVERY-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${suffix}`;
}

export function exhibitionRecoveryApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return Response.json({
    error: message.includes("no such table")
      ? "展后复原数据库尚未初始化，请完成新版部署后再试。"
      : message.includes("Cloudflare R2 binding")
        ? "展后复原证据存储暂时不可用，请检查图片存储配置。"
        : message.includes("UNIQUE constraint failed")
          ? "该展期监测已经建立复原记录，请刷新页面。"
          : fallback,
  }, { status: 500 });
}
