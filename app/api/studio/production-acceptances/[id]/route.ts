import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  productionAcceptances,
  type NewProductionAcceptance,
  type ProductionAcceptance,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanProductionAcceptanceText,
  normalizeProductionAcceptanceDateTime,
  productionAcceptanceApiError,
  productionAcceptanceInteger,
  productionAcceptanceSeal,
} from "@/lib/production-acceptance-input";
import {
  getProductionAcceptance,
  listAllProductionAcceptanceChecks,
  listAllProductionAcceptanceImages,
  PRODUCTION_ACCEPTANCE_DECISIONS,
  PRODUCTION_ACCEPTANCE_STATUSES,
  productionAcceptanceMissingFields,
  type ProductionAcceptanceDecision,
  type ProductionAcceptanceStatus,
} from "@/lib/production-acceptances";
import { listAllProductionExceptions } from "@/lib/production-exceptions";
import { getProductionRelease } from "@/lib/production-releases";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  status?: ProductionAcceptanceStatus;
  decision?: ProductionAcceptanceDecision;
  editionReference?: string;
  colorway?: string;
  sizeRange?: string;
  receivedQuantity?: number | string;
  inspectedQuantity?: number | string;
  receivedAt?: string | null;
  inspectedAt?: string | null;
  physicalLocation?: string;
  inspectionStandard?: string;
  overallObservation?: string;
  dispositionNote?: string;
  notes?: string;
};

const transitions: Record<
  ProductionAcceptanceStatus,
  ProductionAcceptanceStatus[]
> = {
  draft: ["draft", "in_review", "void"],
  in_review: ["in_review", "accepted", "rejected", "void"],
  accepted: ["accepted"],
  rejected: ["rejected"],
  void: ["void"],
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getProductionAcceptance(id);
    if (!current) {
      return Response.json({ error: "成衣验收记录不存在。" }, { status: 404 });
    }
    if (["accepted", "rejected", "void"].includes(current.status)) {
      return Response.json(
        { error: "该验收事实已经冻结，不能改写。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewProductionAcceptance> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    for (const [key, maxLength] of [
      ["editionReference", 180],
      ["colorway", 240],
      ["sizeRange", 180],
      ["physicalLocation", 240],
      ["inspectionStandard", 3000],
      ["overallObservation", 4000],
      ["dispositionNote", 4000],
      ["notes", 4000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanProductionAcceptanceText(payload[key], maxLength);
        changed = true;
      }
    }
    for (const key of ["receivedQuantity", "inspectedQuantity"] as const) {
      if (payload[key] !== undefined) {
        update[key] = productionAcceptanceInteger(payload[key]);
        changed = true;
      }
    }
    for (const key of ["receivedAt", "inspectedAt"] as const) {
      if (payload[key] !== undefined) {
        const normalized = normalizeProductionAcceptanceDateTime(payload[key]);
        if (payload[key] && !normalized) {
          return Response.json(
            { error: key === "receivedAt" ? "到达时间无效。" : "验收时间无效。" },
            { status: 400 },
          );
        }
        update[key] = normalized;
        changed = true;
      }
    }
    if (payload.decision !== undefined) {
      if (!PRODUCTION_ACCEPTANCE_DECISIONS.includes(payload.decision)) {
        return Response.json({ error: "验收决定无效。" }, { status: 400 });
      }
      update.decision = payload.decision;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!PRODUCTION_ACCEPTANCE_STATUSES.includes(payload.status)) {
        return Response.json({ error: "验收状态无效。" }, { status: 400 });
      }
      if (!transitions[current.status].includes(payload.status)) {
        return Response.json(
          { error: "请按草稿、复核、决定的顺序推进验收。" },
          { status: 409 },
        );
      }
      update.status = payload.status;
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const candidate = { ...current, ...update } as ProductionAcceptance;
    if (
      candidate.receivedQuantity > 0 &&
      candidate.inspectedQuantity > candidate.receivedQuantity
    ) {
      return Response.json(
        { error: "抽检数量不能超过本次到达数量。" },
        { status: 400 },
      );
    }
    if (["accepted", "rejected"].includes(candidate.status)) {
      if (candidate.decision === "pending") {
        return Response.json(
          { error: "形成最终状态前，请选择明确的人工验收决定。" },
          { status: 409 },
        );
      }
      if (candidate.status === "accepted" && candidate.decision !== "accept") {
        return Response.json(
          { error: "只有“通过”决定可以生成人工验收标识。" },
          { status: 409 },
        );
      }
      if (candidate.status === "rejected" && candidate.decision === "accept") {
        return Response.json(
          { error: "“通过”决定不能进入未通过状态。" },
          { status: 409 },
        );
      }
      if (!candidate.dispositionNote.trim()) {
        return Response.json(
          { error: "形成最终决定前，请写明处置结论。" },
          { status: 409 },
        );
      }
    }
    if (candidate.status === "accepted") {
      const [release, checks, images, exceptions] = await Promise.all([
        getProductionRelease(current.productionReleaseId),
        listAllProductionAcceptanceChecks(),
        listAllProductionAcceptanceImages(),
        listAllProductionExceptions(),
      ]);
      if (!release || release.status !== "released" || !release.authorizationCode) {
        return Response.json(
          { error: "关联生产放行必须保持 NERA-GO 有效状态。" },
          { status: 409 },
        );
      }
      const blocking = exceptions.filter(
        (item) =>
          item.productionReleaseId === release.id &&
          ["high", "critical"].includes(item.severity) &&
          !["closed", "withdrawn"].includes(item.status),
      );
      if (blocking.length > 0) {
        return Response.json(
          { error: `仍有 ${blocking.length} 条高风险生产偏差未关闭，不能通过验收。` },
          { status: 409 },
        );
      }
      const linkedImages = images.filter(
        (image) =>
          image.productionAcceptanceId === id && image.status === "active",
      );
      const missing = productionAcceptanceMissingFields(candidate, linkedImages);
      if (missing.length > 0) {
        return Response.json(
          { error: `通过前仍需补齐：${missing.join("、")}。` },
          { status: 409 },
        );
      }
      const criticalChecks = checks.filter(
        (check) => check.productionAcceptanceId === id && check.critical,
      );
      if (
        criticalChecks.length < 8 ||
        criticalChecks.some((check) => check.result !== "pass")
      ) {
        const failed = criticalChecks.filter((check) => check.result === "fail").length;
        const pending = criticalChecks.filter((check) => check.result !== "pass").length;
        return Response.json(
          { error: `成衣核对仍有 ${failed} 项失败、${pending - failed} 项未通过。` },
          { status: 409 },
        );
      }
      const now = new Date();
      update.inspectedAt = candidate.inspectedAt || now.toISOString();
      update.acceptedBy = auth.user.email;
      update.acceptedAt = now.toISOString();
      update.acceptanceSeal = productionAcceptanceSeal(now);
    }

    const db = await getDb();
    const [acceptance] = await db
      .update(productionAcceptances)
      .set(update)
      .where(eq(productionAcceptances.id, id))
      .returning();
    return Response.json({ acceptance });
  } catch (error) {
    return productionAcceptanceApiError(
      error,
      "保存成衣验收失败，请稍后重试。",
    );
  }
}
