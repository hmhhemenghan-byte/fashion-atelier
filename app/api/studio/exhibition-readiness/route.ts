import { getDb } from "@/db";
import {
  exhibitionReadinessChecks,
  exhibitionReadinessPlans,
  type NewExhibitionReadinessCheck,
  type NewExhibitionReadinessPlan,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanExhibitionText,
  exhibitionApiError,
  exhibitionPlanCode,
  normalizeExhibitionDateTime,
} from "@/lib/exhibition-readiness-input";
import {
  buildExhibitionOverview,
  DEFAULT_EXHIBITION_CHECKS,
  exhibitionChecksToCsv,
  exhibitionImagesToCsv,
  exhibitionPlansToCsv,
  listAllExhibitionReadinessPlans,
} from "@/lib/exhibition-readiness";
import { getConservationReport } from "@/lib/conservation-reports";
import { getSampleAsset } from "@/lib/sample-inventory";

export const dynamic = "force-dynamic";

type CreatePayload = {
  conservationReportId?: string;
  title?: string;
  venue?: string;
  installAt?: string | null;
  deinstallAt?: string | null;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const overview = await buildExhibitionOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "plans") return csvResponse(exhibitionPlansToCsv(overview), `nera-exhibition-plans-${date}.csv`);
    if (format === "checks") return csvResponse(exhibitionChecksToCsv(overview), `nera-exhibition-checks-${date}.csv`);
    if (format === "images") return csvResponse(exhibitionImagesToCsv(overview), `nera-exhibition-evidence-${date}.csv`);
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-exhibition-readiness-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json({ overview }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return exhibitionApiError(error, "无法读取展陈准备室，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as CreatePayload;
    const conservationReportId = cleanExhibitionText(payload.conservationReportId, 120);
    if (!conservationReportId) return Response.json({ error: "请选择一份已批准养护报告。" }, { status: 400 });
    const report = await getConservationReport(conservationReportId);
    if (!report) return Response.json({ error: "养护报告不存在。" }, { status: 404 });
    if (!["approved", "closed"].includes(report.status)) {
      return Response.json({ error: "只有已批准或已关闭的养护事实可以进入展陈准备。" }, { status: 409 });
    }
    const asset = await getSampleAsset(report.sampleAssetId);
    if (!asset) return Response.json({ error: "实物档案不存在。" }, { status: 404 });
    if (["missing", "archived"].includes(asset.status)) {
      return Response.json({ error: "遗失或已归档实物不能建立展陈方案。" }, { status: 409 });
    }
    const installAt = normalizeExhibitionDateTime(payload.installAt);
    const deinstallAt = normalizeExhibitionDateTime(payload.deinstallAt);
    if ((payload.installAt && !installAt) || (payload.deinstallAt && !deinstallAt)) {
      return Response.json({ error: "安装或撤展时间无效。" }, { status: 400 });
    }
    const all = await listAllExhibitionReadinessPlans();
    const sequence = all.filter((item) => item.sampleAssetId === asset.id)
      .reduce((latest, item) => Math.max(latest, item.sequence), 0) + 1;
    const now = new Date();
    const nowIso = now.toISOString();
    const id = crypto.randomUUID();
    const values: NewExhibitionReadinessPlan = {
      id,
      planCode: exhibitionPlanCode(asset.assetCode, sequence, now),
      sampleAssetId: asset.id,
      conservationReportId: report.id,
      workId: asset.workId,
      sequence,
      title: cleanExhibitionText(payload.title, 240),
      venue: cleanExhibitionText(payload.venue, 240),
      purpose: "exhibition",
      status: "draft",
      decision: "pending",
      installAt,
      deinstallAt,
      displayMode: "mannequin",
      mountingMethod: "",
      supportRequirements: "",
      dressingInstructions: "",
      maxLux: 50,
      uvLimit: 75,
      rhMin: 45,
      rhMax: 55,
      tempMin: 18,
      tempMax: 21,
      maxDisplayDays: 90,
      handlingTeam: "",
      securityBarrier: "",
      emergencyInstructions: "",
      installationNotes: "",
      approvalNote: "",
      approvedBy: "",
      approvedAt: null,
      closedBy: "",
      closedAt: null,
      createdBy: auth.user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const checks: NewExhibitionReadinessCheck[] = DEFAULT_EXHIBITION_CHECKS.map((check, index) => ({
      id: crypto.randomUUID(),
      exhibitionReadinessPlanId: id,
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
      db.insert(exhibitionReadinessPlans).values(values),
      db.insert(exhibitionReadinessChecks).values(checks),
    ]);
    return Response.json({ plan: values }, { status: 201 });
  } catch (error) {
    return exhibitionApiError(error, "建立展陈方案失败，请稍后重试。");
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
