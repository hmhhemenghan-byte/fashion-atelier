import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionRecoveries, type ExhibitionRecovery, type NewExhibitionRecovery } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  EXHIBITION_RECOVERY_DECISIONS,
  EXHIBITION_RECOVERY_STATUSES,
  exhibitionRecoveryMissingFields,
  getExhibitionRecovery,
  listAllExhibitionRecoveryChecks,
  listAllExhibitionRecoveryImages,
  type ExhibitionRecoveryDecision,
  type ExhibitionRecoveryStatus,
} from "@/lib/exhibition-recovery";
import { cleanRecoveryText, exhibitionRecoveryApiError, normalizeRecoveryDateTime } from "@/lib/exhibition-recovery-input";
import { getExhibitionWatch } from "@/lib/exhibition-watch";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type Payload = {
  status?: ExhibitionRecoveryStatus; decision?: ExhibitionRecoveryDecision; receivedAt?: string | null;
  handler?: string; intakeLocation?: string; packingCondition?: string; transitCondition?: string;
  unpackingObservation?: string; supportRemovalNote?: string; postDisplayCondition?: string;
  acclimatizationUntil?: string | null; treatmentRequired?: boolean; treatmentNote?: string;
  storageLocation?: string; recoveryNote?: string;
};
const transitions: Record<ExhibitionRecoveryStatus, ExhibitionRecoveryStatus[]> = {
  intake: ["intake", "stabilizing", "in_review", "referred", "void"],
  stabilizing: ["stabilizing", "in_review", "referred", "void"],
  in_review: ["in_review", "intake", "stabilizing", "released", "referred", "void"],
  released: ["released"], referred: ["referred"], void: ["void"],
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getExhibitionRecovery(id);
    if (!current) return Response.json({ error: "展后复原记录不存在。" }, { status: 404 });
    if (["released", "referred", "void"].includes(current.status)) return Response.json({ error: "该复原事实已经冻结，不能改写。" }, { status: 409 });
    const payload = (await request.json()) as Payload;
    const update: Partial<NewExhibitionRecovery> = { updatedAt: new Date().toISOString() };
    let changed = false;
    for (const [key, max] of [
      ["handler", 500], ["intakeLocation", 1000], ["packingCondition", 3000], ["transitCondition", 3000],
      ["unpackingObservation", 5000], ["supportRemovalNote", 4000], ["postDisplayCondition", 5000],
      ["treatmentNote", 5000], ["storageLocation", 1000], ["recoveryNote", 5000],
    ] as const) {
      if (payload[key] !== undefined) { update[key] = cleanRecoveryText(payload[key], max); changed = true; }
    }
    for (const key of ["receivedAt", "acclimatizationUntil"] as const) {
      if (payload[key] !== undefined) {
        const value = normalizeRecoveryDateTime(payload[key]);
        if (payload[key] && !value) return Response.json({ error: key === "receivedAt" ? "接收时间无效。" : "静置截止时间无效。" }, { status: 400 });
        update[key] = value; changed = true;
      }
    }
    if (payload.treatmentRequired !== undefined) { update.treatmentRequired = Boolean(payload.treatmentRequired); changed = true; }
    if (payload.decision !== undefined) {
      if (!EXHIBITION_RECOVERY_DECISIONS.includes(payload.decision)) return Response.json({ error: "人工复原决定无效。" }, { status: 400 });
      update.decision = payload.decision; changed = true;
    }
    if (payload.status !== undefined) {
      if (!EXHIBITION_RECOVERY_STATUSES.includes(payload.status) || !transitions[current.status].includes(payload.status)) return Response.json({ error: "请按接收、静置、复核与放行顺序推进。" }, { status: 409 });
      update.status = payload.status; changed = true;
    }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const candidate = { ...current, ...update } as ExhibitionRecovery;
    if (!candidate.handler.trim() || !candidate.intakeLocation.trim()) return Response.json({ error: "接收负责人和接收地点不能为空。" }, { status: 409 });
    if (candidate.status === "released" || candidate.status === "referred") {
      const [watch, checks, images] = await Promise.all([
        getExhibitionWatch(current.exhibitionWatchId), listAllExhibitionRecoveryChecks(), listAllExhibitionRecoveryImages(),
      ]);
      if (!watch || !["deinstalled", "closed"].includes(watch.status)) return Response.json({ error: "来源撤展事实无效，不能形成最终结论。" }, { status: 409 });
      const linkedImages = images.filter((image) => image.exhibitionRecoveryId === id && image.status === "active");
      const missing = exhibitionRecoveryMissingFields(candidate, linkedImages);
      if (missing.length > 0) return Response.json({ error: `形成结论前仍需补齐：${missing.join("、")}。` }, { status: 409 });
      const linkedChecks = checks.filter((check) => check.exhibitionRecoveryId === id && check.critical);
      if (linkedChecks.length < 6 || linkedChecks.some((check) => ["pending", "blocked"].includes(check.result))) return Response.json({ error: "六项复原核对仍有未完成或阻塞项。" }, { status: 409 });
      if (candidate.status === "released") {
        if (!["return_to_storage", "rest_then_store"].includes(candidate.decision) || candidate.treatmentRequired) return Response.json({ error: "需要养护或隔离的作品不能直接回库放行。" }, { status: 409 });
        if (candidate.decision === "return_to_storage" && linkedChecks.some((check) => check.result === "attention")) return Response.json({ error: "直接回库前不能保留需要关注的核对项。" }, { status: 409 });
        if (candidate.decision === "rest_then_store" && (!candidate.acclimatizationUntil || new Date(candidate.acclimatizationUntil).getTime() > Date.now())) return Response.json({ error: "静置期尚未完成，不能回库放行。" }, { status: 409 });
        update.releasedBy = auth.user.email; update.releasedAt = new Date().toISOString();
      } else {
        if (!["conservation_review", "quarantine"].includes(candidate.decision) || !candidate.treatmentNote.trim()) return Response.json({ error: "转交前请选择养护复核或隔离，并记录具体原因。" }, { status: 409 });
        update.referredAt = new Date().toISOString();
      }
    }
    const db = await getDb();
    const [recovery] = await db.update(exhibitionRecoveries).set(update).where(eq(exhibitionRecoveries.id, id)).returning();
    return Response.json({ recovery });
  } catch (error) {
    return exhibitionRecoveryApiError(error, "保存展后复原记录失败，请稍后重试。");
  }
}
