import { getDb } from "@/db";
import { exhibitionWatches, type NewExhibitionWatch } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { getExhibitionReadinessPlan } from "@/lib/exhibition-readiness";
import { getSampleAsset } from "@/lib/sample-inventory";
import {
  buildExhibitionWatchOverview,
  exhibitionWatchImagesToCsv,
  exhibitionWatchObservationsToCsv,
  exhibitionWatchesToCsv,
  listAllExhibitionWatches,
} from "@/lib/exhibition-watch";
import { cleanWatchText, exhibitionWatchApiError, exhibitionWatchCode, watchInteger } from "@/lib/exhibition-watch-input";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const overview = await buildExhibitionWatchOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "watches") return csvResponse(exhibitionWatchesToCsv(overview), `nera-exhibition-watches-${date}.csv`);
    if (format === "observations") return csvResponse(exhibitionWatchObservationsToCsv(overview), `nera-exhibition-observations-${date}.csv`);
    if (format === "images") return csvResponse(exhibitionWatchImagesToCsv(overview), `nera-exhibition-watch-evidence-${date}.csv`);
    if (format === "json") return new Response(JSON.stringify(overview, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="nera-exhibition-watch-${date}.json"`, "cache-control": "private, no-store" } });
    return Response.json({ overview }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return exhibitionWatchApiError(error, "无法读取展期监测台，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as { exhibitionReadinessPlanId?: string; steward?: string; openingCondition?: string; monitoringIntervalHours?: number | string };
    const planId = cleanWatchText(payload.exhibitionReadinessPlanId, 120);
    if (!planId) return Response.json({ error: "请选择一份已批准展陈方案。" }, { status: 400 });
    const plan = await getExhibitionReadinessPlan(planId);
    if (!plan) return Response.json({ error: "展陈方案不存在。" }, { status: 404 });
    if (plan.status !== "approved" || !["ready", "ready_with_limits"].includes(plan.decision)) return Response.json({ error: "只有人工批准并允许展示的方案可以开始展期监测。" }, { status: 409 });
    const asset = await getSampleAsset(plan.sampleAssetId);
    if (!asset || ["missing", "archived"].includes(asset.status)) return Response.json({ error: "实物当前不可进入展期监测。" }, { status: 409 });
    if ((await listAllExhibitionWatches()).some((item) => item.exhibitionReadinessPlanId === plan.id)) return Response.json({ error: "该展陈方案已经建立监测记录。" }, { status: 409 });
    const steward = cleanWatchText(payload.steward, 500);
    const openingCondition = cleanWatchText(payload.openingCondition, 3000);
    if (!steward || !openingCondition) return Response.json({ error: "请记录监测负责人和开场状态。" }, { status: 400 });
    const now = new Date();
    const nowIso = now.toISOString();
    const values: NewExhibitionWatch = {
      id: crypto.randomUUID(), watchCode: exhibitionWatchCode(plan.planCode, now), exhibitionReadinessPlanId: plan.id,
      sampleAssetId: plan.sampleAssetId, status: "active", decision: "pending",
      monitoringIntervalHours: watchInteger(payload.monitoringIntervalHours, 24, 1, 720), steward, openingCondition,
      decisionNote: "", deinstallationCondition: "", returnLocation: "", openedAt: nowIso,
      lastObservedAt: null, deinstalledAt: null, closedBy: "", closedAt: null,
      createdBy: auth.user.email, createdAt: nowIso, updatedAt: nowIso,
    };
    const db = await getDb();
    await db.insert(exhibitionWatches).values(values);
    return Response.json({ watch: values }, { status: 201 });
  } catch (error) {
    return exhibitionWatchApiError(error, "建立展期监测失败，请稍后重试。");
  }
}

function csvResponse(body: string, filename: string) {
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
}
