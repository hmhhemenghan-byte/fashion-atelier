export function cleanDeliveryText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeDeliveryDateTime(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeDeliveryInteger(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(10000, Math.trunc(parsed)));
}

export function exhibitionDeliveryCode(now: Date, revision: number) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const token = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `DELIV-${date}-R${String(revision).padStart(2, "0")}-${token}`;
}

export function deliveryApiError(error: unknown, message: string) {
  console.error(message, error instanceof Error ? error.message : "Unknown error");
  return Response.json({ error: message }, { status: 500 });
}
