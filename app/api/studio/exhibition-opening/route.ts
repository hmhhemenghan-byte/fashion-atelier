import { getDb } from "@/db";
import { exhibitionOpeningGates, exhibitionOpeningItems, type NewExhibitionOpeningGate, type NewExhibitionOpeningItem } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { buildCuratorialOverview } from "@/lib/archive-curation";
import { buildExhibitionInstallationOverview } from "@/lib/exhibition-installation";
import { buildExhibitionOpeningOverview, listAllExhibitionOpeningGates, openingGatesToCsv, openingItemsForProject, openingItemsToCsv } from "@/lib/exhibition-opening";
import { cleanOpeningText, exhibitionOpeningCode, normalizeOpeningDateTime, openingApiError } from "@/lib/exhibition-opening-input";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try { const overview = await buildExhibitionOpeningOverview(); const format = new URL(request.url).searchParams.get("format"); const date = new Date().toISOString().slice(0, 10); if (format === "gates") return csvResponse(openingGatesToCsv(overview), `nera-exhibition-opening-gates-${date}.csv`); if (format === "items") return csvResponse(openingItemsToCsv(overview), `nera-exhibition-opening-items-${date}.csv`); if (format === "json") return new Response(JSON.stringify(overview, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="nera-exhibition-opening-${date}.json"`, "cache-control": "private, no-store" } }); return Response.json({ overview }, { headers: { "cache-control": "private, no-store" } }); } catch (error) { return openingApiError(error, "无法读取展览开放签核台，请稍后重试。"); }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as { exhibitionInstallationGateId?: string; openingLead?: string; venue?: string; plannedOpeningAt?: string | null; plannedClosingAt?: string | null };
    const exhibitionInstallationGateId = cleanOpeningText(payload.exhibitionInstallationGateId, 120); const openingLead = cleanOpeningText(payload.openingLead, 500); const venue = cleanOpeningText(payload.venue, 1000); const plannedOpeningAt = normalizeOpeningDateTime(payload.plannedOpeningAt); const plannedClosingAt = normalizeOpeningDateTime(payload.plannedClosingAt);
    if (!exhibitionInstallationGateId || !openingLead) return Response.json({ error: "请选择已批准装校签核并填写开放负责人。" }, { status: 400 });
    if ((payload.plannedOpeningAt && !plannedOpeningAt) || (payload.plannedClosingAt && !plannedClosingAt)) return Response.json({ error: "开放或闭展时间无效。" }, { status: 400 });
    const [installation, curation, existing] = await Promise.all([buildExhibitionInstallationOverview(), buildCuratorialOverview(), listAllExhibitionOpeningGates()]);
    const source = installation.gates.find((item) => item.gate.id === exhibitionInstallationGateId); if (!source) return Response.json({ error: "展览装校签核不存在。" }, { status: 404 }); if (!["approved", "closed"].includes(source.gate.status)) return Response.json({ error: "只能从已批准或关闭的装校签核建立开放总签核。" }, { status: 409 });
    const projectId = source.delivery?.curatorialProjectId ?? ""; const project = curation.projects.find((item) => item.project.id === projectId); if (!project || !["approved", "closed"].includes(project.project.status)) return Response.json({ error: "装校签核未连接同一已批准策展项目。" }, { status: 409 }); const included = project.selections.filter((item) => item.decision === "include"); if (included.length === 0) return Response.json({ error: "策展项目没有纳入作品。" }, { status: 409 });
    const revision = Math.max(0, ...existing.filter((item) => item.curatorialProjectId === projectId).map((item) => item.revision)) + 1; const now = new Date(); const nowIso = now.toISOString(); const id = crypto.randomUUID();
    const values: NewExhibitionOpeningGate = { id, openingCode: exhibitionOpeningCode(now, revision), curatorialProjectId: projectId, exhibitionInstallationGateId, revision, status: "draft", decision: "pending", openingLead, venue: venue || source.gate.venue, plannedOpeningAt: plannedOpeningAt || project.project.openingAt || source.gate.openingAt, plannedClosingAt: plannedClosingAt || project.project.closingAt, operatingBrief: "", dailyCheckCadence: "", staffHandover: "", visitorAccessibilityPlan: "", incidentEscalation: "", emergencyPauseRule: "", approvalNote: "", approvedBy: "", approvedAt: null, closedAt: null, createdBy: auth.user.email, createdAt: nowIso, updatedAt: nowIso };
    const items: NewExhibitionOpeningItem[] = openingItemsForProject(project, id, auth.user.email, nowIso); const db = await getDb(); await db.batch([db.insert(exhibitionOpeningGates).values(values), db.insert(exhibitionOpeningItems).values(items)]); return Response.json({ gate: values }, { status: 201 });
  } catch (error) { return openingApiError(error, "建立展览开放签核失败，请稍后重试。"); }
}
function csvResponse(body: string, filename: string) { return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } }); }
