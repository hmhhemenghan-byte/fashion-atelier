import { getDb } from "@/db";
import {
  exhibitionRecoveries,
  exhibitionRecoveryChecks,
  type NewExhibitionRecovery,
  type NewExhibitionRecoveryCheck,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  buildExhibitionRecoveryOverview,
  DEFAULT_EXHIBITION_RECOVERY_CHECKS,
  exhibitionRecoveriesToCsv,
  exhibitionRecoveryChecksToCsv,
  exhibitionRecoveryImagesToCsv,
  listAllExhibitionRecoveries,
} from "@/lib/exhibition-recovery";
import { cleanRecoveryText, exhibitionRecoveryApiError, exhibitionRecoveryCode, normalizeRecoveryDateTime } from "@/lib/exhibition-recovery-input";
import { getExhibitionWatch } from "@/lib/exhibition-watch";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const overview = await buildExhibitionRecoveryOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "recoveries") return csvResponse(exhibitionRecoveriesToCsv(overview), `nera-exhibition-recoveries-${date}.csv`);
    if (format === "checks") return csvResponse(exhibitionRecoveryChecksToCsv(overview), `nera-exhibition-recovery-checks-${date}.csv`);
    if (format === "images") return csvResponse(exhibitionRecoveryImagesToCsv(overview), `nera-exhibition-recovery-evidence-${date}.csv`);
    if (format === "json") return new Response(JSON.stringify(overview, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="nera-exhibition-recovery-${date}.json"`, "cache-control": "private, no-store" } });
    return Response.json({ overview }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return exhibitionRecoveryApiError(error, "无法读取展后复原室，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as { exhibitionWatchId?: string; receivedAt?: string; handler?: string; intakeLocation?: string };
    const exhibitionWatchId = cleanRecoveryText(payload.exhibitionWatchId, 120);
    if (!exhibitionWatchId) return Response.json({ error: "请选择已经完成撤展交接的监测记录。" }, { status: 400 });
    const watch = await getExhibitionWatch(exhibitionWatchId);
    if (!watch) return Response.json({ error: "展期监测记录不存在。" }, { status: 404 });
    if (!["deinstalled", "closed"].includes(watch.status) || !watch.deinstalledAt || !watch.deinstallationCondition.trim() || !watch.returnLocation.trim()) {
      return Response.json({ error: "只有已记录撤展时间、离场品相与回库位置的监测记录可以建立复原档案。" }, { status: 409 });
    }
    if ((await listAllExhibitionRecoveries()).some((item) => item.exhibitionWatchId === watch.id)) {
      return Response.json({ error: "该展期监测已经建立复原记录。" }, { status: 409 });
    }
    const handler = cleanRecoveryText(payload.handler, 500);
    const intakeLocation = cleanRecoveryText(payload.intakeLocation, 1000) || watch.returnLocation;
    const receivedAt = normalizeRecoveryDateTime(payload.receivedAt) ?? new Date().toISOString();
    if (!handler || !intakeLocation) return Response.json({ error: "请记录接收负责人和接收地点。" }, { status: 400 });
    const now = new Date();
    const nowIso = now.toISOString();
    const id = crypto.randomUUID();
    const values: NewExhibitionRecovery = {
      id,
      recoveryCode: exhibitionRecoveryCode(watch.watchCode, now),
      exhibitionWatchId: watch.id,
      sampleAssetId: watch.sampleAssetId,
      status: "intake",
      decision: "pending",
      receivedAt,
      handler,
      intakeLocation,
      packingCondition: "",
      transitCondition: "",
      unpackingObservation: "",
      supportRemovalNote: "",
      postDisplayCondition: watch.deinstallationCondition,
      acclimatizationUntil: null,
      treatmentRequired: false,
      treatmentNote: "",
      storageLocation: watch.returnLocation,
      recoveryNote: "",
      releasedBy: "",
      releasedAt: null,
      referredAt: null,
      createdBy: auth.user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const checks: NewExhibitionRecoveryCheck[] = DEFAULT_EXHIBITION_RECOVERY_CHECKS.map((check, index) => ({
      id: crypto.randomUUID(), exhibitionRecoveryId: id, category: check.category, title: check.title,
      requirement: check.requirement, result: "pending", observation: "", critical: true, sortOrder: index,
      createdBy: auth.user.email, createdAt: nowIso, updatedAt: nowIso,
    }));
    const db = await getDb();
    await db.batch([db.insert(exhibitionRecoveries).values(values), db.insert(exhibitionRecoveryChecks).values(checks)]);
    return Response.json({ recovery: values }, { status: 201 });
  } catch (error) {
    return exhibitionRecoveryApiError(error, "建立展后复原记录失败，请稍后重试。");
  }
}

function csvResponse(body: string, filename: string) {
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
}
