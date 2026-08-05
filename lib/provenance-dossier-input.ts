export function cleanProvenanceText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeProvenanceDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? match[0] : null;
}

export function provenanceSlug(value: unknown): string {
  return cleanProvenanceText(value, 120)
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function provenanceDossierCode(
  lookNumber: string,
  revision: number,
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
  return `PROV-${date}-${look || fallback.toUpperCase()}-R${String(revision).padStart(2, "0")}`;
}

export function provenanceApiError(error: unknown, fallback: string): Response {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "溯源档案数据库尚未初始化，请完成新版部署后再试。"
        : message.includes("UNIQUE constraint failed")
          ? "档案编号或公开地址已存在，请刷新后重试。"
          : fallback,
    },
    { status: 500 },
  );
}
