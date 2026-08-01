import { getDb } from "@/db";
import {
  productionReleaseChecks,
  productionReleases,
  type NewProductionRelease,
  type NewProductionReleaseCheck,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanProductionReleaseText,
  normalizeProductionReleaseDate,
  productionReleaseApiError,
  productionReleaseCode,
} from "@/lib/production-release-input";
import {
  buildProductionReleaseOverview,
  DEFAULT_PRODUCTION_RELEASE_CHECKS,
  listAllProductionReleases,
  PRODUCTION_RELEASE_MODES,
  productionReleaseChecksToCsv,
  productionReleasesToCsv,
  type ProductionReleaseMode,
} from "@/lib/production-releases";
import { getSampleSignoff } from "@/lib/sample-signoffs";
import { getTechnicalPack } from "@/lib/technical-packs";
import { getWorkById } from "@/lib/works";

export const dynamic = "force-dynamic";

type CreatePayload = {
  sampleSignoffId?: string;
  releaseMode?: ProductionReleaseMode;
  factoryName?: string;
  factoryReference?: string;
  sizeRange?: string;
  colorways?: string;
  plannedWindowStart?: string | null;
  plannedWindowEnd?: string | null;
  internalNotes?: string;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await buildProductionReleaseOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "releases") {
      return csvResponse(
        productionReleasesToCsv(overview),
        `nera-production-releases-${date}.csv`,
      );
    }
    if (format === "checks") {
      return csvResponse(
        productionReleaseChecksToCsv(overview),
        `nera-production-release-checks-${date}.csv`,
      );
    }
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-production-release-desk-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return productionReleaseApiError(
      error,
      "无法读取生产放行台，请稍后重试。",
    );
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const sampleSignoffId = cleanProductionReleaseText(
      payload.sampleSignoffId,
      120,
    );
    if (!sampleSignoffId) {
      return Response.json(
        { error: "请选择已经封存的最终样衣。" },
        { status: 400 },
      );
    }
    const signoff = await getSampleSignoff(sampleSignoffId);
    if (!signoff) {
      return Response.json({ error: "封样记录不存在。" }, { status: 404 });
    }
    if (signoff.status !== "sealed" || !signoff.sealCode) {
      return Response.json(
        { error: "最终样衣生成封样标识后，才能建立生产放行包。" },
        { status: 409 },
      );
    }
    if (!["preproduction", "final"].includes(signoff.sampleType)) {
      return Response.json(
        { error: "只有产前样或最终样可以进入生产放行。" },
        { status: 409 },
      );
    }
    const [pack, work] = await Promise.all([
      getTechnicalPack(signoff.technicalPackId),
      getWorkById(signoff.workId),
    ]);
    if (!pack || !["approved", "locked"].includes(pack.status)) {
      return Response.json(
        { error: "关联技术包必须保持批准或锁定状态。" },
        { status: 409 },
      );
    }
    if (!work) {
      return Response.json({ error: "对应 Look 不存在。" }, { status: 404 });
    }
    const releaseMode = payload.releaseMode ?? "atelier";
    if (!PRODUCTION_RELEASE_MODES.includes(releaseMode)) {
      return Response.json({ error: "放行方式无效。" }, { status: 400 });
    }
    const plannedWindowStart = normalizeProductionReleaseDate(
      payload.plannedWindowStart,
    );
    const plannedWindowEnd = normalizeProductionReleaseDate(
      payload.plannedWindowEnd,
    );
    if (payload.plannedWindowStart && !plannedWindowStart) {
      return Response.json({ error: "计划开始日期无效。" }, { status: 400 });
    }
    if (payload.plannedWindowEnd && !plannedWindowEnd) {
      return Response.json({ error: "计划结束日期无效。" }, { status: 400 });
    }
    if (
      plannedWindowStart &&
      plannedWindowEnd &&
      plannedWindowEnd < plannedWindowStart
    ) {
      return Response.json(
        { error: "计划结束日期不能早于开始日期。" },
        { status: 400 },
      );
    }
    const existing = await listAllProductionReleases();
    const sequence =
      existing
        .filter((release) => release.sampleSignoffId === signoff.id)
        .reduce(
          (latest, release) => Math.max(latest, release.sequence),
          0,
        ) + 1;
    const now = new Date();
    const nowIso = now.toISOString();
    const releaseId = crypto.randomUUID();
    const values: NewProductionRelease = {
      id: releaseId,
      releaseCode: productionReleaseCode(
        work.lookNumber,
        sequence,
        now,
      ),
      sampleSignoffId: signoff.id,
      technicalPackId: pack.id,
      workId: work.id,
      sequence,
      releaseMode,
      status: "draft",
      decision: "pending",
      factoryName: cleanProductionReleaseText(payload.factoryName, 180),
      factoryReference: cleanProductionReleaseText(
        payload.factoryReference,
        180,
      ),
      sizeRange: cleanProductionReleaseText(payload.sizeRange, 180),
      colorways: cleanProductionReleaseText(payload.colorways, 500),
      plannedWindowStart,
      plannedWindowEnd,
      qualityStandard: "",
      packagingInstruction: "",
      releaseSummary: "",
      openRisk: "",
      internalNotes: cleanProductionReleaseText(
        payload.internalNotes,
        4000,
      ),
      approvedBy: "",
      approvedAt: null,
      authorizationCode: null,
      releasedAt: null,
      createdBy: auth.user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const checks: NewProductionReleaseCheck[] =
      DEFAULT_PRODUCTION_RELEASE_CHECKS.map((check, index) => ({
        id: crypto.randomUUID(),
        productionReleaseId: releaseId,
        category: check.category,
        title: check.title,
        requirement: check.requirement,
        result: "pending",
        observation: "",
        critical: true,
        sortOrder: index,
        createdBy: auth.user.email,
        createdAt: nowIso,
        updatedAt: nowIso,
      }));
    const db = await getDb();
    await db.batch([
      db.insert(productionReleases).values(values),
      db.insert(productionReleaseChecks).values(checks),
    ]);
    return Response.json({ release: values }, { status: 201 });
  } catch (error) {
    return productionReleaseApiError(
      error,
      "建立生产放行包失败，请稍后重试。",
    );
  }
}

function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
