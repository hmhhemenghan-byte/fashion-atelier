import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { curatorialSelections, type NewCuratorialSelection } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { CURATORIAL_SELECTION_DECISIONS, CURATORIAL_SELECTION_ROLES, getCuratorialProject, getCuratorialSelection, type CuratorialSelectionDecision, type CuratorialSelectionRole } from "@/lib/archive-curation";
import { cleanCurationText, curationApiError, curationInteger } from "@/lib/archive-curation-input";

type RouteContext = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params; const current = await getCuratorialSelection(id);
    if (!current) return Response.json({ error: "策展选择不存在。" }, { status: 404 });
    const project = await getCuratorialProject(current.curatorialProjectId);
    if (!project) return Response.json({ error: "策展项目不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(project.status)) return Response.json({ error: "该策展选择已经冻结。" }, { status: 409 });
    const payload = (await request.json()) as { decision?: CuratorialSelectionDecision; role?: CuratorialSelectionRole; sequence?: number | string; rationale?: string; displayIntent?: string; conservationNote?: string };
    const update: Partial<NewCuratorialSelection> = { updatedAt: new Date().toISOString() }; let changed = false;
    if (payload.decision !== undefined) { if (!CURATORIAL_SELECTION_DECISIONS.includes(payload.decision)) return Response.json({ error: "纳入决定无效。" }, { status: 400 }); update.decision = payload.decision; changed = true; }
    if (payload.role !== undefined) { if (!CURATORIAL_SELECTION_ROLES.includes(payload.role)) return Response.json({ error: "叙事角色无效。" }, { status: 400 }); update.role = payload.role; changed = true; }
    if (payload.sequence !== undefined) { update.sequence = curationInteger(payload.sequence, current.sequence); changed = true; }
    for (const [key, max] of [["rationale", 4000], ["displayIntent", 4000], ["conservationNote", 4000]] as const) { if (payload[key] !== undefined) { update[key] = cleanCurationText(payload[key], max); changed = true; } }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb(); const [selection] = await db.update(curatorialSelections).set(update).where(eq(curatorialSelections.id, id)).returning();
    return Response.json({ selection });
  } catch (error) { return curationApiError(error, "保存策展选择失败，请稍后重试。"); }
}
