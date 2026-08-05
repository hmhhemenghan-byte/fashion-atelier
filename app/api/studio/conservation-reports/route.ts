import { getDb } from "@/db";
import {
  conservationReportChecks,
  conservationReports,
  type NewConservationReport,
  type NewConservationReportCheck,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanConservationText,
  conservationApiError,
  conservationReportCode,
  normalizeConservationDateTime,
} from "@/lib/conservation-input";
import {
  buildConservationOverview,
  conservationChecksToCsv,
  conservationImagesToCsv,
  conservationReportsToCsv,
  DEFAULT_CONSERVATION_CHECKS,
  listAllConservationReports,
} from "@/lib/conservation-reports";
import { getSampleAsset } from "@/lib/sample-inventory";

export const dynamic = "force-dynamic";

type CreatePayload = {
  sampleAssetId?: string;
  assessedAt?: string | null;
  assessmentLocation?: string;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const overview = await buildConservationOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "reports") {
      return csvResponse(
        conservationReportsToCsv(overview),
        `nera-conservation-reports-${date}.csv`,
      );
    }
    if (format === "checks") {
      return csvResponse(
        conservationChecksToCsv(overview),
        `nera-conservation-checks-${date}.csv`,
      );
    }
    if (format === "images") {
      return csvResponse(
        conservationImagesToCsv(overview),
        `nera-conservation-evidence-${date}.csv`,
      );
    }
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-conservation-atelier-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return conservationApiError(error, "无法读取作品养护室，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as CreatePayload;
    const sampleAssetId = cleanConservationText(payload.sampleAssetId, 120);
    if (!sampleAssetId) {
      return Response.json({ error: "请选择一件可检查的实物档案。" }, { status: 400 });
    }
    const asset = await getSampleAsset(sampleAssetId);
    if (!asset) {
      return Response.json({ error: "实物档案不存在。" }, { status: 404 });
    }
    if (["missing", "archived"].includes(asset.status)) {
      return Response.json(
        { error: "遗失或已归档实物不能直接建立状态检查，请先在实物盘点台确认。" },
        { status: 409 },
      );
    }
    const assessedAt = normalizeConservationDateTime(payload.assessedAt);
    if (payload.assessedAt && !assessedAt) {
      return Response.json({ error: "检查时间无效。" }, { status: 400 });
    }
    const all = await listAllConservationReports();
    const sequence =
      all
        .filter((item) => item.sampleAssetId === asset.id)
        .reduce((latest, item) => Math.max(latest, item.sequence), 0) + 1;
    const now = new Date();
    const nowIso = now.toISOString();
    const id = crypto.randomUUID();
    const values: NewConservationReport = {
      id,
      reportCode: conservationReportCode(asset.assetCode, sequence, now),
      sampleAssetId: asset.id,
      workId: asset.workId,
      sequence,
      status: "draft",
      decision: "pending",
      assessedAt: assessedAt || nowIso,
      assessmentLocation:
        cleanConservationText(payload.assessmentLocation, 240) ||
        asset.currentLocation,
      overallCondition: asset.condition,
      conditionSummary: "",
      proposedTreatment: "",
      handlingRestriction: "",
      storageGuidance: "",
      environmentalNotes: "",
      nextReviewAt: null,
      treatmentCompletedAt: null,
      approvalNote: "",
      approvedBy: "",
      approvedAt: null,
      closedBy: "",
      closedAt: null,
      createdBy: auth.user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const checks: NewConservationReportCheck[] = DEFAULT_CONSERVATION_CHECKS.map(
      (check, index) => ({
        id: crypto.randomUUID(),
        conservationReportId: id,
        category: check.category,
        title: check.title,
        requirement: check.requirement,
        result: "pending",
        severity: "none",
        observation: "",
        treatmentNote: "",
        sortOrder: index,
        createdBy: auth.user.email,
        createdAt: nowIso,
        updatedAt: nowIso,
      }),
    );
    const db = await getDb();
    await db.batch([
      db.insert(conservationReports).values(values),
      db.insert(conservationReportChecks).values(checks),
    ]);
    return Response.json({ report: values }, { status: 201 });
  } catch (error) {
    return conservationApiError(error, "建立养护报告失败，请稍后重试。");
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
