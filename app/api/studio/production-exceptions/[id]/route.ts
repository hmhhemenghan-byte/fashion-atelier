import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  productionExceptions,
  type NewProductionException,
  type ProductionException,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanProductionExceptionText,
  normalizeProductionExceptionDate,
  productionExceptionApiError,
} from "@/lib/production-exception-input";
import {
  getProductionException,
  PRODUCTION_EXCEPTION_CATEGORIES,
  PRODUCTION_EXCEPTION_DECISIONS,
  PRODUCTION_EXCEPTION_SEVERITIES,
  PRODUCTION_EXCEPTION_STATUSES,
  productionExceptionMissingFields,
  type ProductionExceptionCategory,
  type ProductionExceptionDecision,
  type ProductionExceptionSeverity,
  type ProductionExceptionStatus,
} from "@/lib/production-exceptions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  category?: ProductionExceptionCategory;
  severity?: ProductionExceptionSeverity;
  status?: ProductionExceptionStatus;
  decision?: ProductionExceptionDecision;
  title?: string;
  sourceName?: string;
  sourceReference?: string;
  affectedScope?: string;
  observedDeviation?: string;
  proposedResponse?: string;
  designImpact?: string;
  qualityRisk?: string;
  evidenceReference?: string;
  ownerName?: string;
  discoveredAt?: string | null;
  dueAt?: string | null;
  verificationNote?: string;
  resolutionNote?: string;
  successorReleaseCode?: string;
};

const transitions: Record<ProductionExceptionStatus, ProductionExceptionStatus[]> = {
  open: ["open", "in_review", "withdrawn"],
  in_review: ["in_review", "decided", "withdrawn"],
  decided: ["decided", "verified"],
  verified: ["verified", "closed"],
  closed: ["closed"],
  withdrawn: ["withdrawn"],
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getProductionException(id);
    if (!current) {
      return Response.json({ error: "生产偏差记录不存在。" }, { status: 404 });
    }
    if (["closed", "withdrawn"].includes(current.status)) {
      return Response.json(
        { error: "该偏差事实已经冻结，不能改写。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewProductionException> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    for (const [key, maxLength] of [
      ["title", 240],
      ["sourceName", 180],
      ["sourceReference", 240],
      ["affectedScope", 2000],
      ["observedDeviation", 4000],
      ["proposedResponse", 4000],
      ["designImpact", 4000],
      ["qualityRisk", 4000],
      ["evidenceReference", 1000],
      ["ownerName", 180],
      ["verificationNote", 4000],
      ["resolutionNote", 4000],
      ["successorReleaseCode", 180],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanProductionExceptionText(payload[key], maxLength);
        changed = true;
      }
    }
    for (const key of ["discoveredAt", "dueAt"] as const) {
      if (payload[key] !== undefined) {
        const normalized = normalizeProductionExceptionDate(payload[key]);
        if (payload[key] && !normalized) {
          return Response.json(
            { error: key === "discoveredAt" ? "发现日期无效。" : "复核期限无效。" },
            { status: 400 },
          );
        }
        update[key] = normalized;
        changed = true;
      }
    }
    if (payload.category !== undefined) {
      if (!PRODUCTION_EXCEPTION_CATEGORIES.includes(payload.category)) {
        return Response.json({ error: "偏差类别无效。" }, { status: 400 });
      }
      update.category = payload.category;
      changed = true;
    }
    if (payload.severity !== undefined) {
      if (!PRODUCTION_EXCEPTION_SEVERITIES.includes(payload.severity)) {
        return Response.json({ error: "严重程度无效。" }, { status: 400 });
      }
      update.severity = payload.severity;
      changed = true;
    }
    if (payload.decision !== undefined) {
      if (!PRODUCTION_EXCEPTION_DECISIONS.includes(payload.decision)) {
        return Response.json({ error: "设计决定无效。" }, { status: 400 });
      }
      if (["decided", "verified"].includes(current.status)) {
        return Response.json(
          { error: "设计决定已经冻结。" },
          { status: 409 },
        );
      }
      update.decision = payload.decision;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!PRODUCTION_EXCEPTION_STATUSES.includes(payload.status)) {
        return Response.json({ error: "偏差状态无效。" }, { status: 400 });
      }
      if (!transitions[current.status].includes(payload.status)) {
        return Response.json(
          { error: "请按复核、决定、验证、关闭的顺序推进偏差。" },
          { status: 409 },
        );
      }
      update.status = payload.status;
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const candidate = { ...current, ...update } as ProductionException;
    if (
      candidate.discoveredAt &&
      candidate.dueAt &&
      candidate.dueAt < candidate.discoveredAt
    ) {
      return Response.json(
        { error: "复核期限不能早于发现日期。" },
        { status: 400 },
      );
    }
    if (!candidate.title.trim()) {
      return Response.json({ error: "偏差标题不能为空。" }, { status: 400 });
    }
    const now = new Date().toISOString();
    if (candidate.status === "decided" && current.status !== "decided") {
      if (candidate.decision === "pending") {
        return Response.json(
          { error: "请先选择明确的设计决定。" },
          { status: 409 },
        );
      }
      const missing = productionExceptionMissingFields(candidate);
      if (missing.length > 0) {
        return Response.json(
          { error: `形成决定前仍需补齐：${missing.join("、")}。` },
          { status: 409 },
        );
      }
      update.decidedBy = auth.user.email;
      update.decidedAt = now;
    }
    if (candidate.status === "verified" && current.status !== "verified") {
      if (!candidate.verificationNote.trim()) {
        return Response.json(
          { error: "验证前请记录实际处置结果与核验事实。" },
          { status: 409 },
        );
      }
      update.verifiedBy = auth.user.email;
      update.verifiedAt = now;
    }
    if (candidate.status === "closed" && current.status !== "closed") {
      if (!candidate.resolutionNote.trim()) {
        return Response.json(
          { error: "关闭前请写明最终闭环结论。" },
          { status: 409 },
        );
      }
      if (
        candidate.decision === "revise_definition" &&
        !candidate.successorReleaseCode.trim()
      ) {
        return Response.json(
          { error: "修改产品定义时，请记录后续生产放行编号。" },
          { status: 409 },
        );
      }
      update.closedAt = now;
    }

    const db = await getDb();
    const [record] = await db
      .update(productionExceptions)
      .set(update)
      .where(eq(productionExceptions.id, id))
      .returning();
    return Response.json({ exception: record });
  } catch (error) {
    return productionExceptionApiError(
      error,
      "保存生产偏差失败，请稍后重试。",
    );
  }
}
