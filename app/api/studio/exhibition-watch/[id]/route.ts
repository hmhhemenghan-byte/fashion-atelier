import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionWatches, type NewExhibitionWatch } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { EXHIBITION_WATCH_DECISIONS, EXHIBITION_WATCH_STATUSES, getExhibitionWatch, listAllExhibitionWatchObservations, type ExhibitionWatchDecision, type ExhibitionWatchStatus } from "@/lib/exhibition-watch";
import { cleanWatchText, exhibitionWatchApiError, watchInteger } from "@/lib/exhibition-watch-input";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type Payload = { status?: ExhibitionWatchStatus; decision?: ExhibitionWatchDecision; monitoringIntervalHours?: number | string; steward?: string; openingCondition?: string; decisionNote?: string; deinstallationCondition?: string; returnLocation?: string };
const transitions: Record<ExhibitionWatchStatus, ExhibitionWatchStatus[]> = {
  active: ["active", "paused", "deinstalled"], paused: ["paused", "active", "deinstalled"], deinstalled: ["deinstalled", "closed"], closed: ["closed"],
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getExhibitionWatch(id);
    if (!current) return Response.json({ error: "展期监测记录不存在。" }, { status: 404 });
    if (current.status === "closed") return Response.json({ error: "该监测事实已关闭，不能改写。" }, { status: 409 });
    const payload = (await request.json()) as Payload;
    const update: Partial<NewExhibitionWatch> = { updatedAt: new Date().toISOString() };
    let changed = false;
    for (const [key, max] of [["steward", 500], ["openingCondition", 3000], ["decisionNote", 4000], ["deinstallationCondition", 4000], ["returnLocation", 1000]] as const) {
      if (payload[key] !== undefined) { update[key] = cleanWatchText(payload[key], max); changed = true; }
    }
    if (payload.monitoringIntervalHours !== undefined) { update.monitoringIntervalHours = watchInteger(payload.monitoringIntervalHours, current.monitoringIntervalHours, 1, 720); changed = true; }
    if (payload.decision !== undefined) {
      if (!EXHIBITION_WATCH_DECISIONS.includes(payload.decision)) return Response.json({ error: "人工监测决定无效。" }, { status: 400 });
      update.decision = payload.decision; changed = true;
    }
    if (payload.status !== undefined) {
      if (!EXHIBITION_WATCH_STATUSES.includes(payload.status) || !transitions[current.status].includes(payload.status)) return Response.json({ error: "请按监测、暂停、撤展与关闭顺序推进。" }, { status: 409 });
      update.status = payload.status; changed = true;
    }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const candidate = { ...current, ...update };
    if (!candidate.steward.trim() || !candidate.openingCondition.trim()) return Response.json({ error: "监测负责人和开场状态不能为空。" }, { status: 409 });
    if (candidate.status === "deinstalled" && !candidate.deinstalledAt) update.deinstalledAt = new Date().toISOString();
    if (candidate.status === "closed") {
      const observations = (await listAllExhibitionWatchObservations()).filter((item) => item.exhibitionWatchId === id);
      if (observations.length === 0 || !candidate.deinstallationCondition.trim() || !candidate.returnLocation.trim() || !candidate.decisionNote.trim()) return Response.json({ error: "关闭前必须完成至少一次监测、撤展状态、回库位置和人工结论。" }, { status: 409 });
      update.closedBy = auth.user.email; update.closedAt = new Date().toISOString();
    }
    const db = await getDb();
    const [watch] = await db.update(exhibitionWatches).set(update).where(eq(exhibitionWatches.id, id)).returning();
    return Response.json({ watch });
  } catch (error) {
    return exhibitionWatchApiError(error, "保存展期监测失败，请稍后重试。");
  }
}
