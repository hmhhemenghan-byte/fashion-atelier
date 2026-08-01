function cleanSegment(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
  return normalized.slice(0, 18) || "LOOK";
}

export function cleanProductionExceptionText(
  value: unknown,
  maxLength = 1000,
) {
  return typeof value === "string"
    ? value.trim().replace(/\u0000/g, "").slice(0, maxLength)
    : "";
}

export function normalizeProductionExceptionDate(
  value: unknown,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : normalized;
}

export function productionExceptionCode(
  lookNumber: string,
  sequence: number,
  now = new Date(),
) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `DEV-${date}-${cleanSegment(lookNumber)}-${String(sequence).padStart(2, "0")}`;
}

export function productionExceptionApiError(
  error: unknown,
  fallback: string,
) {
  console.error(error);
  return Response.json({ error: fallback }, { status: 500 });
}
