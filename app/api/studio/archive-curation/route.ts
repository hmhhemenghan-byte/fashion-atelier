import { getDb } from "@/db";
import { curatorialProjects, type NewCuratorialProject } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { buildCuratorialOverview, curatorialProjectsToCsv, curatorialSelectionsToCsv } from "@/lib/archive-curation";
import { cleanCurationText, curationApiError, curatorialProjectCode, normalizeCurationDateTime } from "@/lib/archive-curation-input";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const overview = await buildCuratorialOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "projects") return csvResponse(curatorialProjectsToCsv(overview), `nera-curatorial-projects-${date}.csv`);
    if (format === "selections") return csvResponse(curatorialSelectionsToCsv(overview), `nera-curatorial-selections-${date}.csv`);
    if (format === "json") return new Response(JSON.stringify(overview, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="nera-archive-curation-${date}.json"`, "cache-control": "private, no-store" } });
    return Response.json({ overview }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return curationApiError(error, "无法读取档案策展室，请稍后重试。"); }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as { title?: string; curator?: string; venueContext?: string; openingAt?: string | null; closingAt?: string | null };
    const title = cleanCurationText(payload.title, 240);
    const curator = cleanCurationText(payload.curator, 500);
    const venueContext = cleanCurationText(payload.venueContext, 1000);
    if (!title || !curator) return Response.json({ error: "请填写策展项目标题和负责人。" }, { status: 400 });
    const openingAt = normalizeCurationDateTime(payload.openingAt); const closingAt = normalizeCurationDateTime(payload.closingAt);
    if ((payload.openingAt && !openingAt) || (payload.closingAt && !closingAt)) return Response.json({ error: "展期时间无效。" }, { status: 400 });
    if (openingAt && closingAt && new Date(closingAt).getTime() <= new Date(openingAt).getTime()) return Response.json({ error: "结束时间必须晚于开始时间。" }, { status: 400 });
    const now = new Date(); const nowIso = now.toISOString();
    const values: NewCuratorialProject = {
      id: crypto.randomUUID(), projectCode: curatorialProjectCode(now), title, status: "draft", decision: "pending",
      curator, venueContext, audience: "", openingAt, closingAt, thesis: "", narrative: "", spatialNote: "", selectionNote: "", approvalNote: "",
      approvedBy: "", approvedAt: null, closedAt: null, createdBy: auth.user.email, createdAt: nowIso, updatedAt: nowIso,
    };
    const db = await getDb(); await db.insert(curatorialProjects).values(values);
    return Response.json({ project: values }, { status: 201 });
  } catch (error) { return curationApiError(error, "建立策展项目失败，请稍后重试。"); }
}

function csvResponse(body: string, filename: string) {
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
}
