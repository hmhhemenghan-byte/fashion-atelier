export function cleanInterpretationText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeInterpretationInteger(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(10000, Math.trunc(parsed)));
}

export function interpretationPackageCode(now: Date, revision: number) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const token = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `TEXT-${date}-R${String(revision).padStart(2, "0")}-${token}`;
}

export function interpretationApiError(error: unknown, message: string) {
  console.error(message, error instanceof Error ? error.message : "Unknown error");
  return Response.json({ error: message }, { status: 500 });
}
