import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { interpretationSections, type NewInterpretationSection } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { getInterpretationPackage, getInterpretationSection } from "@/lib/exhibition-interpretation";
import { cleanInterpretationText, interpretationApiError, normalizeInterpretationInteger } from "@/lib/exhibition-interpretation-input";

type RouteContext = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params; const current = await getInterpretationSection(id);
    if (!current) return Response.json({ error: "叙事章节不存在。" }, { status: 404 });
    const item = await getInterpretationPackage(current.interpretationPackageId);
    if (!item) return Response.json({ error: "展览释读包不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(item.status)) return Response.json({ error: "该释读包已经冻结。" }, { status: 409 });
    const payload = (await request.json()) as { sequence?: number | string; titlePrimary?: string; titleSecondary?: string; bodyPrimary?: string; bodySecondary?: string };
    const update: Partial<NewInterpretationSection> = { updatedAt: new Date().toISOString() }; let changed = false;
    if (payload.sequence !== undefined) { update.sequence = normalizeInterpretationInteger(payload.sequence, current.sequence); changed = true; }
    for (const [key, max] of [["titlePrimary", 500], ["titleSecondary", 500], ["bodyPrimary", 6000], ["bodySecondary", 6000]] as const) { if (payload[key] !== undefined) { update[key] = cleanInterpretationText(payload[key], max); changed = true; } }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb(); const [section] = await db.update(interpretationSections).set(update).where(eq(interpretationSections.id, id)).returning();
    return Response.json({ section });
  } catch (error) { return interpretationApiError(error, "保存叙事章节失败，请稍后重试。"); }
}
