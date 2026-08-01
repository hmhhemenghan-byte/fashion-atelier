import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  productionReleases,
  type NewProductionRelease,
  type ProductionRelease,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanProductionReleaseText,
  normalizeProductionReleaseDate,
  productionAuthorizationCode,
  productionReleaseApiError,
} from "@/lib/production-release-input";
import {
  getProductionRelease,
  listAllProductionReleaseChecks,
  PRODUCTION_RELEASE_DECISIONS,
  PRODUCTION_RELEASE_MODES,
  PRODUCTION_RELEASE_STATUSES,
  productionReleaseMissingFields,
  type ProductionReleaseDecision,
  type ProductionReleaseMode,
  type ProductionReleaseStatus,
} from "@/lib/production-releases";
import { getSampleSignoff } from "@/lib/sample-signoffs";
import { getTechnicalPack } from "@/lib/technical-packs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  releaseMode?: ProductionReleaseMode;
  status?: ProductionReleaseStatus;
  decision?: ProductionReleaseDecision;
  factoryName?: string;
  factoryReference?: string;
  sizeRange?: string;
  colorways?: string;
  plannedWindowStart?: string | null;
  plannedWindowEnd?: string | null;
  qualityStandard?: string;
  packagingInstruction?: string;
  releaseSummary?: string;
  openRisk?: string;
  internalNotes?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getProductionRelease(id);
    if (!current) {
      return Response.json({ error: "生产放行记录不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;

    if (["released", "superseded", "void"].includes(current.status)) {
      return Response.json(
        { error: "该生产放行事实已冻结，不能改写。" },
        { status: 409 },
      );
    }
    if (current.status === "ready") {
      if (
        payload.status === "released" &&
        Object.keys(payload).every((key) => key === "status")
      ) {
        const dependencyError = await validateReleaseDependencies(current);
        if (dependencyError) return dependencyError;
        const now = new Date();
        const db = await getDb();
        const [release] = await db
          .update(productionReleases)
          .set({
            status: "released",
            authorizationCode:
              current.authorizationCode || productionAuthorizationCode(now),
            releasedAt: now.toISOString(),
            updatedAt: now.toISOString(),
          })
          .where(eq(productionReleases.id, id))
          .returning();
        return Response.json({ release });
      }
      return Response.json(
        { error: "已批准放行包不可改写；只能由设计师生成放行标识。" },
        { status: 409 },
      );
    }

    const update: Partial<NewProductionRelease> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    for (const [key, maxLength] of [
      ["factoryName", 180],
      ["factoryReference", 180],
      ["sizeRange", 180],
      ["colorways", 500],
      ["qualityStandard", 4000],
      ["packagingInstruction", 4000],
      ["releaseSummary", 4000],
      ["openRisk", 4000],
      ["internalNotes", 4000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanProductionReleaseText(payload[key], maxLength);
        changed = true;
      }
    }
    for (const key of [
      "plannedWindowStart",
      "plannedWindowEnd",
    ] as const) {
      if (payload[key] !== undefined) {
        const normalized = normalizeProductionReleaseDate(payload[key]);
        if (payload[key] && !normalized) {
          return Response.json(
            {
              error:
                key === "plannedWindowStart"
                  ? "计划开始日期无效。"
                  : "计划结束日期无效。",
            },
            { status: 400 },
          );
        }
        update[key] = normalized;
        changed = true;
      }
    }
    if (payload.releaseMode !== undefined) {
      if (!PRODUCTION_RELEASE_MODES.includes(payload.releaseMode)) {
        return Response.json({ error: "放行方式无效。" }, { status: 400 });
      }
      update.releaseMode = payload.releaseMode;
      changed = true;
    }
    if (payload.decision !== undefined) {
      if (!PRODUCTION_RELEASE_DECISIONS.includes(payload.decision)) {
        return Response.json({ error: "放行结论无效。" }, { status: 400 });
      }
      update.decision = payload.decision;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!PRODUCTION_RELEASE_STATUSES.includes(payload.status)) {
        return Response.json({ error: "放行状态无效。" }, { status: 400 });
      }
      if (["released", "superseded"].includes(payload.status)) {
        return Response.json(
          { error: "只有已准备的放行包才能生成放行标识。" },
          { status: 409 },
        );
      }
      update.status = payload.status;
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const candidate = { ...current, ...update } as ProductionRelease;
    if (
      candidate.plannedWindowStart &&
      candidate.plannedWindowEnd &&
      candidate.plannedWindowEnd < candidate.plannedWindowStart
    ) {
      return Response.json(
        { error: "计划结束日期不能早于开始日期。" },
        { status: 400 },
      );
    }
    if (candidate.status === "ready") {
      const dependencyError = await validateReleaseDependencies(candidate);
      if (dependencyError) return dependencyError;
      if (candidate.decision !== "release") {
        return Response.json(
          { error: "请先将设计师结论设为放行，再批准生产放行包。" },
          { status: 409 },
        );
      }
      const missing = productionReleaseMissingFields(candidate);
      if (missing.length > 0) {
        return Response.json(
          { error: `放行前仍需补齐：${missing.join("、")}。` },
          { status: 409 },
        );
      }
      const checks = (await listAllProductionReleaseChecks()).filter(
        (check) => check.productionReleaseId === id && check.critical,
      );
      if (
        checks.length < 8 ||
        checks.some((check) => check.result !== "ready")
      ) {
        const blocked = checks.filter(
          (check) => check.result === "blocked",
        ).length;
        const pending = checks.filter(
          (check) => check.result !== "ready",
        ).length;
        return Response.json(
          {
            error: `生产准备核对仍有 ${blocked} 项阻塞、${pending - blocked} 项未完成。`,
          },
          { status: 409 },
        );
      }
      const now = new Date().toISOString();
      update.approvedBy = auth.user.email;
      update.approvedAt = now;
    }

    const db = await getDb();
    const [release] = await db
      .update(productionReleases)
      .set(update)
      .where(eq(productionReleases.id, id))
      .returning();
    return Response.json({ release });
  } catch (error) {
    return productionReleaseApiError(
      error,
      "更新生产放行记录失败，请稍后重试。",
    );
  }
}

async function validateReleaseDependencies(release: ProductionRelease) {
  const [signoff, pack] = await Promise.all([
    getSampleSignoff(release.sampleSignoffId),
    getTechnicalPack(release.technicalPackId),
  ]);
  if (!signoff || signoff.status !== "sealed" || !signoff.sealCode) {
    return Response.json(
      { error: "关联最终样衣必须保持封存状态。" },
      { status: 409 },
    );
  }
  if (!pack || !["approved", "locked"].includes(pack.status)) {
    return Response.json(
      { error: "关联技术包必须保持批准或锁定状态。" },
      { status: 409 },
    );
  }
  return null;
}
