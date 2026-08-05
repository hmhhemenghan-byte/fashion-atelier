import { getDb } from "@/db";
import { exhibitionDeliveryItems, exhibitionDeliveryPackages, type NewExhibitionDeliveryItem, type NewExhibitionDeliveryPackage } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { buildExhibitionDeliveryOverview, deliveryBlueprintForInterpretation, exhibitionDeliveryItemsToCsv, exhibitionDeliveryPackagesToCsv, listAllExhibitionDeliveryPackages } from "@/lib/exhibition-delivery";
import { cleanDeliveryText, deliveryApiError, exhibitionDeliveryCode, normalizeDeliveryDateTime } from "@/lib/exhibition-delivery-input";
import { buildInterpretationOverview } from "@/lib/exhibition-interpretation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const overview = await buildExhibitionDeliveryOverview();
    const format = new URL(request.url).searchParams.get("format"); const date = new Date().toISOString().slice(0, 10);
    if (format === "packages") return csvResponse(exhibitionDeliveryPackagesToCsv(overview), `nera-exhibition-delivery-packages-${date}.csv`);
    if (format === "items") return csvResponse(exhibitionDeliveryItemsToCsv(overview), `nera-exhibition-delivery-items-${date}.csv`);
    if (format === "json") return new Response(JSON.stringify(overview, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="nera-exhibition-delivery-${date}.json"`, "cache-control": "private, no-store" } });
    return Response.json({ overview }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return deliveryApiError(error, "无法读取展览交付台，请稍后重试。"); }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as { interpretationPackageId?: string; ownerName?: string; destination?: string; deliveryAt?: string | null };
    const interpretationPackageId = cleanDeliveryText(payload.interpretationPackageId, 120);
    const ownerName = cleanDeliveryText(payload.ownerName, 500); const destination = cleanDeliveryText(payload.destination, 1000);
    const deliveryAt = normalizeDeliveryDateTime(payload.deliveryAt);
    if (!interpretationPackageId || !ownerName) return Response.json({ error: "请选择已批准释读修订并填写交付负责人。" }, { status: 400 });
    if (payload.deliveryAt && !deliveryAt) return Response.json({ error: "计划交付时间无效。" }, { status: 400 });
    const [interpretation, existing] = await Promise.all([buildInterpretationOverview(), listAllExhibitionDeliveryPackages()]);
    const source = interpretation.packages.find((item) => item.package.id === interpretationPackageId);
    if (!source) return Response.json({ error: "展览释读修订不存在。" }, { status: 404 });
    if (!["approved", "closed"].includes(source.package.status)) return Response.json({ error: "只能从已批准或已关闭的冻结释读修订建立交付包。" }, { status: 409 });
    const revision = Math.max(0, ...existing.filter((item) => item.interpretationPackageId === interpretationPackageId).map((item) => item.revision)) + 1;
    const now = new Date(); const nowIso = now.toISOString(); const id = crypto.randomUUID();
    const values: NewExhibitionDeliveryPackage = {
      id, deliveryCode: exhibitionDeliveryCode(now, revision), interpretationPackageId, revision,
      status: "draft", decision: "pending", ownerName, destination, deliveryAt, masterTitle: source.package.title,
      formatStandard: "", placementStandard: "", accessibilityStandard: "", rightsStandard: "", handoffNote: "", approvalNote: "",
      approvedBy: "", approvedAt: null, closedAt: null, createdBy: auth.user.email, createdAt: nowIso, updatedAt: nowIso,
    };
    const items: NewExhibitionDeliveryItem[] = deliveryBlueprintForInterpretation(source).map((item) => ({
      id: crypto.randomUUID(), exhibitionDeliveryPackageId: id, ...item,
      placement: "", formatSpec: "", proofStatus: "draft", proofNote: "", handoffNote: "",
      createdBy: auth.user.email, createdAt: nowIso, updatedAt: nowIso,
    }));
    const db = await getDb(); await db.batch([db.insert(exhibitionDeliveryPackages).values(values), db.insert(exhibitionDeliveryItems).values(items)]);
    return Response.json({ package: values }, { status: 201 });
  } catch (error) { return deliveryApiError(error, "建立展览交付包失败，请稍后重试。"); }
}

function csvResponse(body: string, filename: string) { return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } }); }
