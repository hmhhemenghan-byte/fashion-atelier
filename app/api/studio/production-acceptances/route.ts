import { getDb } from "@/db";
import {
  productionAcceptanceChecks,
  productionAcceptances,
  type NewProductionAcceptance,
  type NewProductionAcceptanceCheck,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanProductionAcceptanceText,
  normalizeProductionAcceptanceDateTime,
  productionAcceptanceApiError,
  productionAcceptanceCode,
  productionAcceptanceInteger,
} from "@/lib/production-acceptance-input";
import {
  buildProductionAcceptanceOverview,
  DEFAULT_PRODUCTION_ACCEPTANCE_CHECKS,
  listAllProductionAcceptances,
  productionAcceptanceChecksToCsv,
  productionAcceptanceImagesToCsv,
  productionAcceptancesToCsv,
} from "@/lib/production-acceptances";
import { getProductionRelease } from "@/lib/production-releases";
import { getWorkById } from "@/lib/works";

export const dynamic = "force-dynamic";

type CreatePayload = {
  productionReleaseId?: string;
  editionReference?: string;
  colorway?: string;
  sizeRange?: string;
  receivedQuantity?: number | string;
  inspectedQuantity?: number | string;
  receivedAt?: string | null;
  physicalLocation?: string;
  notes?: string;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const overview = await buildProductionAcceptanceOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "acceptances") {
      return csvResponse(
        productionAcceptancesToCsv(overview),
        `nera-production-acceptances-${date}.csv`,
      );
    }
    if (format === "checks") {
      return csvResponse(
        productionAcceptanceChecksToCsv(overview),
        `nera-production-acceptance-checks-${date}.csv`,
      );
    }
    if (format === "images") {
      return csvResponse(
        productionAcceptanceImagesToCsv(overview),
        `nera-production-acceptance-evidence-${date}.csv`,
      );
    }
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-edition-acceptance-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return productionAcceptanceApiError(
      error,
      "无法读取成衣验收台，请稍后重试。",
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
    const productionReleaseId = cleanProductionAcceptanceText(
      payload.productionReleaseId,
      120,
    );
    if (!productionReleaseId) {
      return Response.json(
        { error: "请选择已经生成 NERA-GO 的生产放行。" },
        { status: 400 },
      );
    }
    const release = await getProductionRelease(productionReleaseId);
    if (!release || release.status !== "released" || !release.authorizationCode) {
      return Response.json(
        { error: "只有有效的 NERA-GO 生产放行可以建立成衣验收。" },
        { status: 409 },
      );
    }
    const work = await getWorkById(release.workId);
    if (!work) {
      return Response.json({ error: "对应 Look 不存在。" }, { status: 404 });
    }
    const receivedAt = normalizeProductionAcceptanceDateTime(payload.receivedAt);
    if (payload.receivedAt && !receivedAt) {
      return Response.json({ error: "到达时间无效。" }, { status: 400 });
    }
    const all = await listAllProductionAcceptances();
    const sequence =
      all
        .filter((item) => item.productionReleaseId === release.id)
        .reduce((latest, item) => Math.max(latest, item.sequence), 0) + 1;
    const now = new Date();
    const nowIso = now.toISOString();
    const id = crypto.randomUUID();
    const values: NewProductionAcceptance = {
      id,
      acceptanceCode: productionAcceptanceCode(work.lookNumber, sequence, now),
      productionReleaseId: release.id,
      workId: work.id,
      sequence,
      status: "draft",
      decision: "pending",
      editionReference: cleanProductionAcceptanceText(
        payload.editionReference,
        180,
      ),
      colorway:
        cleanProductionAcceptanceText(payload.colorway, 240) ||
        release.colorways,
      sizeRange:
        cleanProductionAcceptanceText(payload.sizeRange, 180) ||
        release.sizeRange,
      receivedQuantity: productionAcceptanceInteger(payload.receivedQuantity),
      inspectedQuantity: productionAcceptanceInteger(payload.inspectedQuantity),
      receivedAt,
      inspectedAt: null,
      physicalLocation: cleanProductionAcceptanceText(
        payload.physicalLocation,
        240,
      ),
      inspectionStandard: release.qualityStandard,
      overallObservation: "",
      dispositionNote: "",
      acceptedBy: "",
      acceptedAt: null,
      acceptanceSeal: null,
      notes: cleanProductionAcceptanceText(payload.notes, 4000),
      createdBy: auth.user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const checks: NewProductionAcceptanceCheck[] =
      DEFAULT_PRODUCTION_ACCEPTANCE_CHECKS.map((check, index) => ({
        id: crypto.randomUUID(),
        productionAcceptanceId: id,
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
      db.insert(productionAcceptances).values(values),
      db.insert(productionAcceptanceChecks).values(checks),
    ]);
    return Response.json({ acceptance: values }, { status: 201 });
  } catch (error) {
    return productionAcceptanceApiError(
      error,
      "建立成衣验收失败，请稍后重试。",
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
