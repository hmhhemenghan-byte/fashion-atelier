export function cleanInstallationText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeInstallationDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function installationInteger(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : fallback;
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1_000_000, Math.round(parsed))) : fallback;
}

export function exhibitionInstallationCode(now = new Date(), revision = 1) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `INSTALL-${date}-R${String(revision).padStart(2, "0")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

export function installationApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "展览装校数据库尚未初始化，请完成新版部署后再试。"
        : message.includes("Cloudflare R2 binding")
          ? "装校证据存储暂时不可用，请检查图片存储配置。"
          : message.includes("UNIQUE constraint failed")
            ? "该交付主档的装校修订已经存在，请刷新后建立下一轮。"
            : fallback,
    },
    { status: 500 },
  );
}
