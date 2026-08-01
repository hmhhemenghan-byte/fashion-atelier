import { getDb } from "@/db";
import {
  productionExceptionActions,
  productionExceptions,
  type NewProductionException,
  type NewProductionExceptionAction,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanProductionExceptionText,
  normalizeProductionExceptionDate,
  productionExceptionApiError,
  productionExceptionCode,
} from "@/lib/production-exception-input";
import {
  buildProductionExceptionOverview,
  listAllProductionExceptions,
  PRODUCTION_EXCEPTION_CATEGORIES,
  PRODUCTION_EXCEPTION_SEVERITIES,
  productionExceptionActionsToCsv,
  productionExceptionsToCsv,
  type ProductionExceptionCategory,
  type ProductionExceptionSeverity,
} from "@/lib/production-exceptions";
import { getProductionRelease } from "@/lib/production-releases";
import { getWorkById } from "@/lib/works";

export const dynamic = "force-dynamic";

type CreatePayload = {
  productionReleaseId?: string;
  category?: ProductionExceptionCategory;
  severity?: ProductionExceptionSeverity;
  title?: string;
  sourceName?: string;
  sourceReference?: string;
  affectedScope?: string;
  observedDeviation?: string;
  evidenceReference?: string;
  ownerName?: string;
  discoveredAt?: string | null;
  dueAt?: string | null;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const overview = await buildProductionExceptionOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "exceptions") {
      return csvResponse(
        productionExceptionsToCsv(overview),
        `nera-production-exceptions-${date}.csv`,
      );
    }
    if (format === "actions") {
      return csvResponse(
        productionExceptionActionsToCsv(overview),
        `nera-production-exception-actions-${date}.csv`,
      );
    }
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-production-change-control-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return productionExceptionApiError(
      error,
      "无法读取生产变更控制台，请稍后重试。",
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
    const productionReleaseId = cleanProductionExceptionText(
      payload.productionReleaseId,
      120,
    );
    const title = cleanProductionExceptionText(payload.title, 240);
    if (!productionReleaseId || !title) {
      return Response.json(
        { error: "请选择已授权放行并填写偏差标题。" },
        { status: 400 },
      );
    }
    const release = await getProductionRelease(productionReleaseId);
    if (
      !release ||
      release.status !== "released" ||
      !release.authorizationCode
    ) {
      return Response.json(
        { error: "只有已经生成 NERA-GO 的生产放行可以建立偏差记录。" },
        { status: 409 },
      );
    }
    const work = await getWorkById(release.workId);
    if (!work) {
      return Response.json({ error: "对应 Look 不存在。" }, { status: 404 });
    }
    const category = payload.category ?? "other";
    const severity = payload.severity ?? "medium";
    if (!PRODUCTION_EXCEPTION_CATEGORIES.includes(category)) {
      return Response.json({ error: "偏差类别无效。" }, { status: 400 });
    }
    if (!PRODUCTION_EXCEPTION_SEVERITIES.includes(severity)) {
      return Response.json({ error: "严重程度无效。" }, { status: 400 });
    }
    const discoveredAt = normalizeProductionExceptionDate(
      payload.discoveredAt,
    );
    const dueAt = normalizeProductionExceptionDate(payload.dueAt);
    if (payload.discoveredAt && !discoveredAt) {
      return Response.json({ error: "发现日期无效。" }, { status: 400 });
    }
    if (payload.dueAt && !dueAt) {
      return Response.json({ error: "复核期限无效。" }, { status: 400 });
    }
    if (discoveredAt && dueAt && dueAt < discoveredAt) {
      return Response.json(
        { error: "复核期限不能早于发现日期。" },
        { status: 400 },
      );
    }
    const existing = await listAllProductionExceptions();
    const sequence =
      existing.filter((item) => item.workId === work.id).length + 1;
    const now = new Date();
    const nowIso = now.toISOString();
    const id = crypto.randomUUID();
    const values: NewProductionException = {
      id,
      exceptionCode: productionExceptionCode(work.lookNumber, sequence, now),
      productionReleaseId: release.id,
      workId: work.id,
      category,
      severity,
      status: "open",
      decision: "pending",
      title,
      sourceName: cleanProductionExceptionText(payload.sourceName, 180),
      sourceReference: cleanProductionExceptionText(
        payload.sourceReference,
        240,
      ),
      affectedScope: cleanProductionExceptionText(payload.affectedScope, 2000),
      observedDeviation: cleanProductionExceptionText(
        payload.observedDeviation,
        4000,
      ),
      proposedResponse: "",
      designImpact: "",
      qualityRisk: "",
      evidenceReference: cleanProductionExceptionText(
        payload.evidenceReference,
        1000,
      ),
      ownerName: cleanProductionExceptionText(payload.ownerName, 180),
      discoveredAt,
      dueAt,
      decidedBy: "",
      decidedAt: null,
      verificationNote: "",
      verifiedBy: "",
      verifiedAt: null,
      resolutionNote: "",
      successorReleaseCode: "",
      closedAt: null,
      createdBy: auth.user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const firstAction: NewProductionExceptionAction = {
      id: crypto.randomUUID(),
      productionExceptionId: id,
      actionType: "reported",
      note:
        values.observedDeviation ||
        `已建立偏差记录：${values.title}`,
      reference: values.evidenceReference,
      occurredAt: discoveredAt
        ? `${discoveredAt}T12:00:00.000Z`
        : nowIso,
      createdBy: auth.user.email,
      createdAt: nowIso,
    };
    const db = await getDb();
    await db.batch([
      db.insert(productionExceptions).values(values),
      db.insert(productionExceptionActions).values(firstAction),
    ]);
    return Response.json({ exception: values }, { status: 201 });
  } catch (error) {
    return productionExceptionApiError(
      error,
      "建立生产偏差记录失败，请稍后重试。",
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
