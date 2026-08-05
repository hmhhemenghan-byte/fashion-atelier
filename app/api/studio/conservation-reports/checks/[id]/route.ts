import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  conservationReportChecks,
  type NewConservationReportCheck,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { cleanConservationText, conservationApiError } from "@/lib/conservation-input";
import {
  CONSERVATION_CHECK_RESULTS,
  CONSERVATION_SEVERITIES,
  getConservationReport,
  getConservationReportCheck,
  type ConservationCheckResult,
  type ConservationSeverity,
} from "@/lib/conservation-reports";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  result?: ConservationCheckResult;
  severity?: ConservationSeverity;
  observation?: string;
  treatmentNote?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getConservationReportCheck(id);
    if (!current) {
      return Response.json({ error: "养护检查项不存在。" }, { status: 404 });
    }
    const report = await getConservationReport(current.conservationReportId);
    if (!report) return Response.json({ error: "养护报告不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(report.status)) {
      return Response.json({ error: "该养护事实已经冻结，不能修改检查项。" }, { status: 409 });
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewConservationReportCheck> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.result !== undefined) {
      if (!CONSERVATION_CHECK_RESULTS.includes(payload.result)) {
        return Response.json({ error: "检查结果无效。" }, { status: 400 });
      }
      update.result = payload.result;
      changed = true;
    }
    if (payload.severity !== undefined) {
      if (!CONSERVATION_SEVERITIES.includes(payload.severity)) {
        return Response.json({ error: "风险级别无效。" }, { status: 400 });
      }
      update.severity = payload.severity;
      changed = true;
    }
    if (payload.observation !== undefined) {
      update.observation = cleanConservationText(payload.observation, 2400);
      changed = true;
    }
    if (payload.treatmentNote !== undefined) {
      update.treatmentNote = cleanConservationText(payload.treatmentNote, 2400);
      changed = true;
    }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const candidate = { ...current, ...update };
    if (
      (["attention", "treatment"].includes(candidate.result || "") ||
        ["medium", "high", "critical"].includes(candidate.severity || "")) &&
      !candidate.observation?.trim()
    ) {
      return Response.json({ error: "待关注或有风险的部位必须记录观察事实。" }, { status: 409 });
    }
    if (candidate.result === "treatment" && !candidate.treatmentNote?.trim()) {
      return Response.json({ error: "待处理部位必须写明处理建议。" }, { status: 409 });
    }
    const db = await getDb();
    const [check] = await db
      .update(conservationReportChecks)
      .set(update)
      .where(eq(conservationReportChecks.id, id))
      .returning();
    return Response.json({ check });
  } catch (error) {
    return conservationApiError(error, "保存养护检查失败，请稍后重试。");
  }
}
