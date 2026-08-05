import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { curatorialProjects, type CuratorialProject, type NewCuratorialProject } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { buildCuratorialOverview, curatorialMissingFields, CURATORIAL_PROJECT_DECISIONS, CURATORIAL_PROJECT_STATUSES, getCuratorialProject, type CuratorialProjectDecision, type CuratorialProjectStatus } from "@/lib/archive-curation";
import { cleanCurationText, curationApiError, normalizeCurationDateTime } from "@/lib/archive-curation-input";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type Payload = { status?: CuratorialProjectStatus; decision?: CuratorialProjectDecision; title?: string; curator?: string; venueContext?: string; audience?: string; openingAt?: string | null; closingAt?: string | null; thesis?: string; narrative?: string; spatialNote?: string; selectionNote?: string; approvalNote?: string };
const transitions: Record<CuratorialProjectStatus, CuratorialProjectStatus[]> = {
  draft: ["draft", "in_review", "void"], in_review: ["in_review", "draft", "approved", "void"], approved: ["approved", "closed"], closed: ["closed"], void: ["void"],
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params; const current = await getCuratorialProject(id);
    if (!current) return Response.json({ error: "策展项目不存在。" }, { status: 404 });
    if (["closed", "void"].includes(current.status)) return Response.json({ error: "该策展事实已经冻结，不能改写。" }, { status: 409 });
    const payload = (await request.json()) as Payload; const update: Partial<NewCuratorialProject> = { updatedAt: new Date().toISOString() }; let changed = false;
    if (current.status === "approved" && (payload.status !== "closed" || Object.keys(payload).some((key) => key !== "status"))) {
      return Response.json({ error: "已批准策展只能关闭，不能改写既有事实。" }, { status: 409 });
    }
    for (const [key, max] of [["title", 240], ["curator", 500], ["venueContext", 1000], ["audience", 1000], ["thesis", 5000], ["narrative", 6000], ["spatialNote", 5000], ["selectionNote", 5000], ["approvalNote", 5000]] as const) {
      if (payload[key] !== undefined) { update[key] = cleanCurationText(payload[key], max); changed = true; }
    }
    for (const key of ["openingAt", "closingAt"] as const) {
      if (payload[key] !== undefined) { const value = normalizeCurationDateTime(payload[key]); if (payload[key] && !value) return Response.json({ error: "展期时间无效。" }, { status: 400 }); update[key] = value; changed = true; }
    }
    if (payload.decision !== undefined) { if (!CURATORIAL_PROJECT_DECISIONS.includes(payload.decision)) return Response.json({ error: "策展决定无效。" }, { status: 400 }); update.decision = payload.decision; changed = true; }
    if (payload.status !== undefined) { if (!CURATORIAL_PROJECT_STATUSES.includes(payload.status) || !transitions[current.status].includes(payload.status)) return Response.json({ error: "请按草稿、评审、批准与关闭顺序推进。" }, { status: 409 }); update.status = payload.status; changed = true; }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const candidate = { ...current, ...update } as CuratorialProject;
    if (!candidate.title.trim() || !candidate.curator.trim()) return Response.json({ error: "项目标题和策展负责人不能为空。" }, { status: 409 });
    if (candidate.openingAt && candidate.closingAt && new Date(candidate.closingAt).getTime() <= new Date(candidate.openingAt).getTime()) return Response.json({ error: "结束时间必须晚于开始时间。" }, { status: 409 });
    if (candidate.status === "approved") {
      const overview = await buildCuratorialOverview(); const workspace = overview.projects.find((item) => item.project.id === id);
      if (!workspace) return Response.json({ error: "无法验证策展项目。" }, { status: 409 });
      if (candidate.decision !== "approve") return Response.json({ error: "批准前必须由设计师明确选择通过策展。" }, { status: 409 });
      const included = workspace.selections.filter((item) => item.decision === "include");
      const missing = curatorialMissingFields(candidate, included);
      if (missing.length > 0) return Response.json({ error: `批准前仍需补齐：${missing.join("、")}。` }, { status: 409 });
      if (workspace.summary.blocked > 0) return Response.json({ error: `有 ${workspace.summary.blocked} 件纳入作品的养护、实物或复原状态仍不允许展示。` }, { status: 409 });
      update.approvedBy = auth.user.email; update.approvedAt = new Date().toISOString();
    }
    if (candidate.status === "closed") update.closedAt = new Date().toISOString();
    const db = await getDb(); const [project] = await db.update(curatorialProjects).set(update).where(eq(curatorialProjects.id, id)).returning();
    return Response.json({ project });
  } catch (error) { return curationApiError(error, "保存策展项目失败，请稍后重试。"); }
}
