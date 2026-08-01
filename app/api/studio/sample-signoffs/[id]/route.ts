import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleSignoffs,
  type NewSampleSignoff,
  type SampleSignoff,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { getFittingSession } from "@/lib/fittings";
import {
  cleanSampleSignoffText,
  normalizeSampleSignoffDateTime,
  sampleSignoffApiError,
  sealedSampleCode,
} from "@/lib/sample-signoff-input";
import {
  getSampleSignoff,
  listAllSampleSignoffChecks,
  listAllSampleSignoffImages,
  SAMPLE_SIGNOFF_DECISIONS,
  SAMPLE_SIGNOFF_STATUSES,
  SAMPLE_SIGNOFF_TYPES,
  sampleSignoffMissingFields,
  type SampleSignoffDecision,
  type SampleSignoffStatus,
  type SampleSignoffType,
} from "@/lib/sample-signoffs";
import { getTechnicalPack } from "@/lib/technical-packs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  sampleType?: SampleSignoffType;
  status?: SampleSignoffStatus;
  decision?: SampleSignoffDecision;
  sampleSize?: string;
  makerReference?: string;
  receivedAt?: string | null;
  reviewedAt?: string | null;
  physicalLocation?: string;
  materialLotReference?: string;
  colorStandardReference?: string;
  overallObservation?: string;
  approvalNote?: string;
  notes?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getSampleSignoff(id);
    if (!current) {
      return Response.json({ error: "封样签核不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;

    if (current.status === "sealed" || current.status === "void") {
      return Response.json(
        { error: "该封样事实已冻结，不能改写。" },
        { status: 409 },
      );
    }
    if (current.status === "approved") {
      if (
        payload.status === "sealed" &&
        Object.keys(payload).every((key) => key === "status")
      ) {
        const now = new Date();
        const db = await getDb();
        const [signoff] = await db
          .update(sampleSignoffs)
          .set({
            status: "sealed",
            sealCode: current.sealCode || sealedSampleCode(now),
            sealedAt: now.toISOString(),
            updatedAt: now.toISOString(),
          })
          .where(eq(sampleSignoffs.id, id))
          .returning();
        return Response.json({ signoff });
      }
      return Response.json(
        { error: "已批准封样不可改写；确认实物后只能进一步封存。" },
        { status: 409 },
      );
    }

    const update: Partial<NewSampleSignoff> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    for (const [key, maxLength] of [
      ["sampleSize", 80],
      ["makerReference", 180],
      ["physicalLocation", 240],
      ["materialLotReference", 180],
      ["colorStandardReference", 180],
      ["overallObservation", 4000],
      ["approvalNote", 2400],
      ["notes", 4000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanSampleSignoffText(payload[key], maxLength);
        changed = true;
      }
    }
    for (const key of ["receivedAt", "reviewedAt"] as const) {
      if (payload[key] !== undefined) {
        const normalized = normalizeSampleSignoffDateTime(payload[key]);
        if (payload[key] && !normalized) {
          return Response.json(
            {
              error:
                key === "receivedAt" ? "收样时间无效。" : "审阅时间无效。",
            },
            { status: 400 },
          );
        }
        update[key] = normalized;
        changed = true;
      }
    }
    if (payload.sampleType !== undefined) {
      if (!SAMPLE_SIGNOFF_TYPES.includes(payload.sampleType)) {
        return Response.json({ error: "样衣类型无效。" }, { status: 400 });
      }
      update.sampleType = payload.sampleType;
      changed = true;
    }
    if (payload.decision !== undefined) {
      if (!SAMPLE_SIGNOFF_DECISIONS.includes(payload.decision)) {
        return Response.json({ error: "签核结论无效。" }, { status: 400 });
      }
      update.decision = payload.decision;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!SAMPLE_SIGNOFF_STATUSES.includes(payload.status)) {
        return Response.json({ error: "签核状态无效。" }, { status: 400 });
      }
      if (payload.status === "sealed") {
        return Response.json(
          { error: "只有已批准封样才能生成封样标识。" },
          { status: 409 },
        );
      }
      update.status = payload.status;
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const candidate = { ...current, ...update } as SampleSignoff;
    if (candidate.status === "approved") {
      const [pack, fitting, checks, images] = await Promise.all([
        getTechnicalPack(current.technicalPackId),
        getFittingSession(current.fittingSessionId),
        listAllSampleSignoffChecks(),
        listAllSampleSignoffImages(),
      ]);
      if (!pack || !["approved", "locked"].includes(pack.status)) {
        return Response.json(
          { error: "关联技术包必须保持批准或锁定状态。" },
          { status: 409 },
        );
      }
      if (!["preproduction", "final"].includes(pack.sampleStage)) {
        return Response.json(
          { error: "技术包样衣阶段必须推进到产前样或最终样。" },
          { status: 409 },
        );
      }
      if (
        !fitting ||
        !["approved", "closed"].includes(fitting.status) ||
        fitting.decision !== "approve"
      ) {
        return Response.json(
          { error: "关联试身必须保持批准或封存状态。" },
          { status: 409 },
        );
      }
      if (candidate.decision !== "approve") {
        return Response.json(
          { error: "请先将签核结论设为通过，再批准最终样衣。" },
          { status: 409 },
        );
      }
      const activeImages = images.filter(
        (image) =>
          image.sampleSignoffId === id && image.status === "active",
      );
      const missing = sampleSignoffMissingFields(candidate, activeImages);
      if (missing.length > 0) {
        return Response.json(
          { error: `批准前仍需补齐：${missing.join("、")}。` },
          { status: 409 },
        );
      }
      const criticalChecks = checks.filter(
        (check) => check.sampleSignoffId === id && check.critical,
      );
      if (
        criticalChecks.length < 8 ||
        criticalChecks.some((check) => check.result !== "pass")
      ) {
        const failed = criticalChecks.filter(
          (check) => check.result === "fail",
        ).length;
        const pending = criticalChecks.filter(
          (check) => check.result !== "pass",
        ).length;
        return Response.json(
          {
            error: `封样核对仍有 ${failed} 项失败、${pending - failed} 项未通过。`,
          },
          { status: 409 },
        );
      }
      const now = new Date().toISOString();
      update.reviewedAt = candidate.reviewedAt || now;
      update.approvedBy = auth.user.email;
      update.approvedAt = now;
    }

    const db = await getDb();
    const [signoff] = await db
      .update(sampleSignoffs)
      .set(update)
      .where(eq(sampleSignoffs.id, id))
      .returning();
    return Response.json({ signoff });
  } catch (error) {
    return sampleSignoffApiError(
      error,
      "更新封样签核失败，请稍后重试。",
    );
  }
}
