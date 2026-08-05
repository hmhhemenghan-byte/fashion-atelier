import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  conservationReports,
  type ConservationReport,
  type NewConservationReport,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanConservationText,
  conservationApiError,
  normalizeConservationDateTime,
} from "@/lib/conservation-input";
import {
  CONSERVATION_CONDITIONS,
  CONSERVATION_REPORT_DECISIONS,
  CONSERVATION_REPORT_STATUSES,
  conservationMissingFields,
  getConservationReport,
  listAllConservationReportChecks,
  listAllConservationReportImages,
  type ConservationCondition,
  type ConservationReportDecision,
  type ConservationReportStatus,
} from "@/lib/conservation-reports";
import { getSampleAsset } from "@/lib/sample-inventory";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  status?: ConservationReportStatus;
  decision?: ConservationReportDecision;
  assessedAt?: string | null;
  assessmentLocation?: string;
  overallCondition?: ConservationCondition;
  conditionSummary?: string;
  proposedTreatment?: string;
  handlingRestriction?: string;
  storageGuidance?: string;
  environmentalNotes?: string;
  nextReviewAt?: string | null;
  treatmentCompletedAt?: string | null;
  approvalNote?: string;
};

const transitions: Record<ConservationReportStatus, ConservationReportStatus[]> = {
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
    const current = await getConservationReport(id);
    if (!current) {
      return Response.json({ error: "养护报告不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;
    if (["closed", "void"].includes(current.status)) {
      return Response.json({ error: "该养护事实已经冻结，不能改写。" }, { status: 409 });
    }
    if (
      current.status === "approved" &&
      (payload.status !== "closed" || Object.keys(payload).some((key) => key !== "status"))
    ) {
      return Response.json(
        { error: "已批准报告不可原地改写；可关闭后建立下一轮检查。" },
        { status: 409 },
      );
    }
    const update: Partial<NewConservationReport> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    for (const [key, maxLength] of [
      ["assessmentLocation", 240],
      ["conditionSummary", 5000],
      ["proposedTreatment", 5000],
      ["handlingRestriction", 3000],
      ["storageGuidance", 4000],
      ["environmentalNotes", 3000],
      ["approvalNote", 4000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanConservationText(payload[key], maxLength);
        changed = true;
      }
    }
    for (const key of ["assessedAt", "nextReviewAt", "treatmentCompletedAt"] as const) {
      if (payload[key] !== undefined) {
        const normalized = normalizeConservationDateTime(payload[key]);
        if (payload[key] && !normalized) {
          return Response.json({ error: "日期或时间无效。" }, { status: 400 });
        }
        update[key] = normalized;
        changed = true;
      }
    }
    if (payload.overallCondition !== undefined) {
      if (!CONSERVATION_CONDITIONS.includes(payload.overallCondition)) {
        return Response.json({ error: "总体状态无效。" }, { status: 400 });
      }
      update.overallCondition = payload.overallCondition;
      changed = true;
    }
    if (payload.decision !== undefined) {
      if (!CONSERVATION_REPORT_DECISIONS.includes(payload.decision)) {
        return Response.json({ error: "养护决定无效。" }, { status: 400 });
      }
      update.decision = payload.decision;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!CONSERVATION_REPORT_STATUSES.includes(payload.status)) {
        return Response.json({ error: "报告状态无效。" }, { status: 400 });
      }
      if (!transitions[current.status].includes(payload.status)) {
        return Response.json(
          { error: "请按草稿、复核、批准与关闭顺序推进。" },
          { status: 409 },
        );
      }
      update.status = payload.status;
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const candidate = { ...current, ...update } as ConservationReport;
    if (candidate.status === "approved") {
      const [asset, checks, images] = await Promise.all([
        getSampleAsset(current.sampleAssetId),
        listAllConservationReportChecks(),
        listAllConservationReportImages(),
      ]);
      if (!asset || ["missing", "archived"].includes(asset.status)) {
        return Response.json(
          { error: "实物当前不可检查，请先在实物盘点台确认。" },
          { status: 409 },
        );
      }
      if (candidate.decision === "pending") {
        return Response.json({ error: "批准前请选择明确的人工养护决定。" }, { status: 409 });
      }
      const linkedImages = images.filter(
        (image) => image.conservationReportId === id && image.status === "active",
      );
      const missing = conservationMissingFields(candidate, linkedImages);
      if (missing.length > 0) {
        return Response.json(
          { error: `批准前仍需补齐：${missing.join("、")}。` },
          { status: 409 },
        );
      }
      const linkedChecks = checks.filter((check) => check.conservationReportId === id);
      if (linkedChecks.length < 6 || linkedChecks.some((check) => check.result === "pending")) {
        return Response.json({ error: "六项部位检查尚未全部形成结论。" }, { status: 409 });
      }
      const critical = linkedChecks.filter(
        (check) =>
          ["high", "critical"].includes(check.severity) &&
          !["resolved", "na"].includes(check.result),
      );
      if (critical.length > 0) {
        return Response.json(
          { error: `仍有 ${critical.length} 项高风险状态未解决，不能批准。` },
          { status: 409 },
        );
      }
      const attention = linkedChecks.filter((check) =>
        ["attention", "treatment"].includes(check.result),
      );
      if (candidate.decision === "ready_for_use" && attention.length > 0) {
        return Response.json(
          { error: "仍有待关注或待处理部位，不能标记为可使用。" },
          { status: 409 },
        );
      }
      if (candidate.decision === "treat" && !candidate.proposedTreatment.trim()) {
        return Response.json({ error: "需要处理时必须写明处理方案。" }, { status: 409 });
      }
      const nowIso = new Date().toISOString();
      update.approvedBy = auth.user.email;
      update.approvedAt = nowIso;
    } else if (candidate.status === "closed") {
      update.closedBy = auth.user.email;
      update.closedAt = new Date().toISOString();
    }

    const db = await getDb();
    const [report] = await db
      .update(conservationReports)
      .set(update)
      .where(eq(conservationReports.id, id))
      .returning();
    return Response.json({ report });
  } catch (error) {
    return conservationApiError(error, "保存养护报告失败，请稍后重试。");
  }
}
