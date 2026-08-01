function cleanSegment(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
  return normalized.slice(0, 18) || "LOOK";
}

export function cleanProductionReleaseText(
  value: unknown,
  maxLength = 1000,
) {
  return typeof value === "string"
    ? value.trim().replace(/\u0000/g, "").slice(0, maxLength)
    : "";
}

export function normalizeProductionReleaseDate(
  value: unknown,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : normalized;
}

export function productionReleaseCode(
  lookNumber: string,
  sequence: number,
  now = new Date(),
) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `PROD-${date}-${cleanSegment(lookNumber)}-R${String(sequence).padStart(2, "0")}`;
}

export function productionAuthorizationCode(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `NERA-GO-${date}-${token}`;
}

export function productionReleaseApiError(
  error: unknown,
  fallback: string,
) {
  console.error(error);
  return Response.json({ error: fallback }, { status: 500 });
}
