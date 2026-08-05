import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionWatchObservations, exhibitionWatches, type NewExhibitionWatchObservation } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { WATCH_CONDITION_RESULTS, WATCH_DISPOSITIONS, WATCH_INCIDENT_TYPES, WATCH_PEST_RESULTS, getExhibitionWatch, type WatchConditionResult, type WatchDisposition, type WatchIncidentType, type WatchPestResult } from "@/lib/exhibition-watch";
import { cleanWatchText, exhibitionWatchApiError, normalizeWatchDateTime, watchInteger, watchTemperatureTenth } from "@/lib/exhibition-watch-input";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type Payload = { observedAt?: string; lux?: number | string; uv?: number | string; rh?: number | string; temperature?: number | string; conditionResult?: WatchConditionResult; supportResult?: WatchConditionResult; pestResult?: WatchPestResult; incidentType?: WatchIncidentType; observation?: string; actionTaken?: string; disposition?: WatchDisposition };

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const watch = await getExhibitionWatch(id);
    if (!watch) return Response.json({ error: "展期监测记录不存在。" }, { status: 404 });
    if (["deinstalled", "closed"].includes(watch.status)) return Response.json({ error: "该展示已经撤展，不能新增在展观察。" }, { status: 409 });
    const payload = (await request.json()) as Payload;
    const observedAt = normalizeWatchDateTime(payload.observedAt) ?? new Date().toISOString();
    const conditionResult = payload.conditionResult ?? "stable";
    const supportResult = payload.supportResult ?? "stable";
    const pestResult = payload.pestResult ?? "none";
    const incidentType = payload.incidentType ?? "none";
    const disposition = payload.disposition ?? "continue";
    if (!WATCH_CONDITION_RESULTS.includes(conditionResult) || !WATCH_CONDITION_RESULTS.includes(supportResult) || !WATCH_PEST_RESULTS.includes(pestResult) || !WATCH_INCIDENT_TYPES.includes(incidentType) || !WATCH_DISPOSITIONS.includes(disposition)) return Response.json({ error: "监测结论无效。" }, { status: 400 });
    const observation = cleanWatchText(payload.observation, 5000);
    const actionTaken = cleanWatchText(payload.actionTaken, 5000);
    const abnormal = conditionResult !== "stable" || supportResult !== "stable" || pestResult !== "none" || incidentType !== "none" || disposition !== "continue";
    if (abnormal && (!observation || !actionTaken)) return Response.json({ error: "发现异常或采取限制时，必须记录观察事实与现场处置。" }, { status: 409 });
    const nowIso = new Date().toISOString();
    const values: NewExhibitionWatchObservation = {
      id: crypto.randomUUID(), exhibitionWatchId: id, observedAt,
      lux: payload.lux === undefined || payload.lux === "" ? null : watchInteger(payload.lux, 0, 0, 100000),
      uv: payload.uv === undefined || payload.uv === "" ? null : watchInteger(payload.uv, 0, 0, 100000),
      rh: payload.rh === undefined || payload.rh === "" ? null : watchInteger(payload.rh, 0, 0, 100),
      temperatureTenth: watchTemperatureTenth(payload.temperature), conditionResult, supportResult, pestResult, incidentType,
      observation, actionTaken, disposition, createdBy: auth.user.email, createdAt: nowIso,
    };
    const watchUpdate = { lastObservedAt: observedAt, updatedAt: nowIso } as { lastObservedAt: string; updatedAt: string; status?: "paused" | "deinstalled"; decision?: "continue" | "continue_with_limits" | "pause" | "deinstall_now"; deinstalledAt?: string };
    if (disposition === "pause" || disposition === "conservator_review") { watchUpdate.status = "paused"; watchUpdate.decision = "pause"; }
    else if (disposition === "deinstall") { watchUpdate.status = "deinstalled"; watchUpdate.decision = "deinstall_now"; watchUpdate.deinstalledAt = nowIso; }
    else if (disposition === "limit") watchUpdate.decision = "continue_with_limits";
    else watchUpdate.decision = "continue";
    const db = await getDb();
    await db.batch([db.insert(exhibitionWatchObservations).values(values), db.update(exhibitionWatches).set(watchUpdate).where(eq(exhibitionWatches.id, id))]);
    return Response.json({ observation: values }, { status: 201 });
  } catch (error) {
    return exhibitionWatchApiError(error, "记录展期观察失败，请稍后重试。");
  }
}
