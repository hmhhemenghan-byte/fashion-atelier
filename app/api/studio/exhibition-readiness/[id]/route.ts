import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionReadinessPlans, type ExhibitionReadinessPlan, type NewExhibitionReadinessPlan } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { cleanExhibitionText, exhibitionApiError, exhibitionInteger, normalizeExhibitionDateTime } from "@/lib/exhibition-readiness-input";
import {
  EXHIBITION_DECISIONS,
  EXHIBITION_DISPLAY_MODES,
  EXHIBITION_PLAN_STATUSES,
  EXHIBITION_PURPOSES,
  exhibitionMissingFields,
  getExhibitionReadinessPlan,
  listAllExhibitionReadinessChecks,
  listAllExhibitionReadinessImages,
  type ExhibitionDecision,
  type ExhibitionDisplayMode,
  type ExhibitionPlanStatus,
  type ExhibitionPurpose,
} from "@/lib/exhibition-readiness";
import { getConservationReport } from "@/lib/conservation-reports";
import { getSampleAsset } from "@/lib/sample-inventory";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  title?: string; venue?: string; purpose?: ExhibitionPurpose;
  status?: ExhibitionPlanStatus; decision?: ExhibitionDecision;
  installAt?: string | null; deinstallAt?: string | null;
  displayMode?: ExhibitionDisplayMode; mountingMethod?: string;
  supportRequirements?: string; dressingInstructions?: string;
  maxLux?: number | string; uvLimit?: number | string;
  rhMin?: number | string; rhMax?: number | string;
  tempMin?: number | string; tempMax?: number | string;
  maxDisplayDays?: number | string; handlingTeam?: string;
  securityBarrier?: string; emergencyInstructions?: string;
  installationNotes?: string; approvalNote?: string;
};

const transitions: Record<ExhibitionPlanStatus, ExhibitionPlanStatus[]> = {
  draft: ["draft", "in_review", "void"],
  in_review: ["in_review", "draft", "approved", "void"],
  approved: ["approved", "closed"],
  closed: ["closed"],
  void: ["void"],
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getExhibitionReadinessPlan(id);
    if (!current) return Response.json({ error: "展陈方案不存在。" }, { status: 404 });
    const payload = (await request.json()) as UpdatePayload;
    if (["closed", "void"].includes(current.status)) return Response.json({ error: "该展陈事实已经冻结，不能改写。" }, { status: 409 });
    if (current.status === "approved" && (payload.status !== "closed" || Object.keys(payload).some((key) => key !== "status"))) {
      return Response.json({ error: "已批准方案不可原地改写；撤展后关闭并建立新轮次。" }, { status: 409 });
    }
    const update: Partial<NewExhibitionReadinessPlan> = { updatedAt: new Date().toISOString() };
    let changed = false;
    for (const [key, maxLength] of [
      ["title", 240], ["venue", 240], ["mountingMethod", 3000],
      ["supportRequirements", 4000], ["dressingInstructions", 4000],
      ["handlingTeam", 1200], ["securityBarrier", 3000],
      ["emergencyInstructions", 4000], ["installationNotes", 4000],
      ["approvalNote", 4000],
    ] as const) {
      if (payload[key] !== undefined) { update[key] = cleanExhibitionText(payload[key], maxLength); changed = true; }
    }
    for (const key of ["installAt", "deinstallAt"] as const) {
      if (payload[key] !== undefined) {
        const normalized = normalizeExhibitionDateTime(payload[key]);
        if (payload[key] && !normalized) return Response.json({ error: "安装或撤展时间无效。" }, { status: 400 });
        update[key] = normalized; changed = true;
      }
    }
    for (const key of ["maxLux", "uvLimit", "rhMin", "rhMax", "tempMin", "tempMax", "maxDisplayDays"] as const) {
      if (payload[key] !== undefined) { update[key] = exhibitionInteger(payload[key], current[key]); changed = true; }
    }
    if (payload.purpose !== undefined) {
      if (!EXHIBITION_PURPOSES.includes(payload.purpose)) return Response.json({ error: "展示用途无效。" }, { status: 400 });
      update.purpose = payload.purpose; changed = true;
    }
    if (payload.displayMode !== undefined) {
      if (!EXHIBITION_DISPLAY_MODES.includes(payload.displayMode)) return Response.json({ error: "展示方式无效。" }, { status: 400 });
      update.displayMode = payload.displayMode; changed = true;
    }
    if (payload.decision !== undefined) {
      if (!EXHIBITION_DECISIONS.includes(payload.decision)) return Response.json({ error: "人工展陈决定无效。" }, { status: 400 });
      update.decision = payload.decision; changed = true;
    }
    if (payload.status !== undefined) {
      if (!EXHIBITION_PLAN_STATUSES.includes(payload.status)) return Response.json({ error: "方案状态无效。" }, { status: 400 });
      if (!transitions[current.status].includes(payload.status)) return Response.json({ error: "请按草稿、复核、批准与关闭顺序推进。" }, { status: 409 });
      update.status = payload.status; changed = true;
    }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });

    const candidate = { ...current, ...update } as ExhibitionReadinessPlan;
    if (candidate.status === "approved") {
      const [asset, report, checks, images] = await Promise.all([
        getSampleAsset(current.sampleAssetId),
        getConservationReport(current.conservationReportId),
        listAllExhibitionReadinessChecks(),
        listAllExhibitionReadinessImages(),
      ]);
      if (!asset || ["missing", "archived"].includes(asset.status)) return Response.json({ error: "实物当前不可展陈，请先在实物盘点台确认。" }, { status: 409 });
      if (!report || !["approved", "closed"].includes(report.status) || report.sampleAssetId !== asset.id) {
        return Response.json({ error: "来源养护报告已经失效或与实物不一致。" }, { status: 409 });
      }
      if (candidate.decision === "pending") return Response.json({ error: "批准前请选择明确的人工展陈决定。" }, { status: 409 });
      const linkedImages = images.filter((image) => image.exhibitionReadinessPlanId === id && image.status === "active");
      const missing = exhibitionMissingFields(candidate, linkedImages);
      if (missing.length > 0) return Response.json({ error: `批准前仍需补齐：${missing.join("、")}。` }, { status: 409 });
      const linkedChecks = checks.filter((check) => check.exhibitionReadinessPlanId === id);
      if (linkedChecks.length < 7 || linkedChecks.some((check) => check.result === "pending")) {
        return Response.json({ error: "七项展陈核对尚未全部形成结论。" }, { status: 409 });
      }
      const blocked = linkedChecks.filter((check) => check.result === "blocked" && check.critical);
      if (blocked.length > 0 && ["ready", "ready_with_limits"].includes(candidate.decision)) {
        return Response.json({ error: `仍有 ${blocked.length} 项关键展陈条件被阻塞，不能放行展示。` }, { status: 409 });
      }
      if (linkedChecks.some((check) => check.result === "attention") && candidate.decision === "ready") {
        return Response.json({ error: "仍有需关注条件，请改为限制展示或先处理。" }, { status: 409 });
      }
      if (candidate.installAt && candidate.deinstallAt) {
        const durationDays = Math.ceil((new Date(candidate.deinstallAt).getTime() - new Date(candidate.installAt).getTime()) / 86_400_000);
        if (durationDays > candidate.maxDisplayDays) return Response.json({ error: "计划展示时长超过人工设定的最大展示天数。" }, { status: 409 });
      }
      update.approvedBy = auth.user.email;
      update.approvedAt = new Date().toISOString();
    } else if (candidate.status === "closed") {
      update.closedBy = auth.user.email;
      update.closedAt = new Date().toISOString();
    }
    const db = await getDb();
    const [plan] = await db.update(exhibitionReadinessPlans).set(update)
      .where(eq(exhibitionReadinessPlans.id, id)).returning();
    return Response.json({ plan });
  } catch (error) {
    return exhibitionApiError(error, "保存展陈方案失败，请稍后重试。");
  }
}
