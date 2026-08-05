import { getDb } from "@/db";
import { exhibitionInstallationChecks, exhibitionInstallationGates, type NewExhibitionInstallationCheck, type NewExhibitionInstallationGate } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { buildExhibitionDeliveryOverview } from "@/lib/exhibition-delivery";
import { buildExhibitionInstallationOverview, installationChecksForDelivery, installationChecksToCsv, installationGatesToCsv, installationImagesToCsv, listAllExhibitionInstallationGates } from "@/lib/exhibition-installation";
import { cleanInstallationText, exhibitionInstallationCode, installationApiError, normalizeInstallationDateTime } from "@/lib/exhibition-installation-input";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const overview = await buildExhibitionInstallationOverview();
    const format = new URL(request.url).searchParams.get("format"); const date = new Date().toISOString().slice(0, 10);
    if (format === "gates") return csvResponse(installationGatesToCsv(overview), `nera-exhibition-installation-gates-${date}.csv`);
    if (format === "checks") return csvResponse(installationChecksToCsv(overview), `nera-exhibition-installation-checks-${date}.csv`);
    if (format === "images") return csvResponse(installationImagesToCsv(overview), `nera-exhibition-installation-images-${date}.csv`);
    if (format === "json") return new Response(JSON.stringify(overview, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="nera-exhibition-installation-${date}.json"`, "cache-control": "private, no-store" } });
    return Response.json({ overview }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return installationApiError(error, "无法读取展览装校签核台，请稍后重试。"); }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as { exhibitionDeliveryPackageId?: string; leadName?: string; venue?: string; inspectionAt?: string | null; openingAt?: string | null };
    const exhibitionDeliveryPackageId = cleanInstallationText(payload.exhibitionDeliveryPackageId, 120);
    const leadName = cleanInstallationText(payload.leadName, 500); const venue = cleanInstallationText(payload.venue, 1000);
    const inspectionAt = normalizeInstallationDateTime(payload.inspectionAt); const openingAt = normalizeInstallationDateTime(payload.openingAt);
    if (!exhibitionDeliveryPackageId || !leadName) return Response.json({ error: "请选择已批准交付主档并填写现场负责人。" }, { status: 400 });
    if ((payload.inspectionAt && !inspectionAt) || (payload.openingAt && !openingAt)) return Response.json({ error: "装校检查或开放时间无效。" }, { status: 400 });
    const [delivery, existing] = await Promise.all([buildExhibitionDeliveryOverview(), listAllExhibitionInstallationGates()]);
    const source = delivery.packages.find((item) => item.package.id === exhibitionDeliveryPackageId);
    if (!source) return Response.json({ error: "展览交付主档不存在。" }, { status: 404 });
    if (!["approved", "closed"].includes(source.package.status)) return Response.json({ error: "只能从已批准或已关闭的冻结交付主档建立装校签核。" }, { status: 409 });
    if (source.items.length === 0) return Response.json({ error: "交付主档没有可核对的交付项。" }, { status: 409 });
    const revision = Math.max(0, ...existing.filter((item) => item.exhibitionDeliveryPackageId === exhibitionDeliveryPackageId).map((item) => item.revision)) + 1;
    const now = new Date(); const nowIso = now.toISOString(); const id = crypto.randomUUID();
    const values: NewExhibitionInstallationGate = {
      id, gateCode: exhibitionInstallationCode(now, revision), exhibitionDeliveryPackageId, revision,
      status: "draft", decision: "pending", leadName, venue, inspectionAt, openingAt,
      installationScope: "", accessibilityObservation: "", rightsObservation: "", safetyNote: "", handoverNote: "", approvalNote: "",
      approvedBy: "", approvedAt: null, closedAt: null, createdBy: auth.user.email, createdAt: nowIso, updatedAt: nowIso,
    };
    const checks: NewExhibitionInstallationCheck[] = installationChecksForDelivery(source, id, auth.user.email, nowIso);
    const db = await getDb(); await db.batch([db.insert(exhibitionInstallationGates).values(values), db.insert(exhibitionInstallationChecks).values(checks)]);
    return Response.json({ gate: values }, { status: 201 });
  } catch (error) { return installationApiError(error, "建立展览装校签核失败，请稍后重试。"); }
}

function csvResponse(body: string, filename: string) { return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } }); }
