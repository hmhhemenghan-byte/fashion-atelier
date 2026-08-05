import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { interpretationLabels, type NewInterpretationLabel } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { getInterpretationLabel, getInterpretationPackage, INTERPRETATION_RIGHTS_STATUSES, type InterpretationRightsStatus } from "@/lib/exhibition-interpretation";
import { cleanInterpretationText, interpretationApiError, normalizeInterpretationInteger } from "@/lib/exhibition-interpretation-input";

type RouteContext = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params; const current = await getInterpretationLabel(id);
    if (!current) return Response.json({ error: "作品标签不存在。" }, { status: 404 });
    const item = await getInterpretationPackage(current.interpretationPackageId);
    if (!item) return Response.json({ error: "展览释读包不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(item.status)) return Response.json({ error: "该释读包已经冻结。" }, { status: 409 });
    const payload = (await request.json()) as { sequence?: number | string; headline?: string; bodyPrimary?: string; bodySecondary?: string; objectFacts?: string; creditLine?: string; accessibilityText?: string; sourceNote?: string; rightsStatus?: InterpretationRightsStatus };
    const update: Partial<NewInterpretationLabel> = { updatedAt: new Date().toISOString() }; let changed = false;
    if (payload.sequence !== undefined) { update.sequence = normalizeInterpretationInteger(payload.sequence, current.sequence); changed = true; }
    for (const [key, max] of [["headline", 500], ["bodyPrimary", 5000], ["bodySecondary", 5000], ["objectFacts", 2000], ["creditLine", 2000], ["accessibilityText", 3000], ["sourceNote", 3000]] as const) { if (payload[key] !== undefined) { update[key] = cleanInterpretationText(payload[key], max); changed = true; } }
    if (payload.rightsStatus !== undefined) { if (!INTERPRETATION_RIGHTS_STATUSES.includes(payload.rightsStatus)) return Response.json({ error: "权利状态无效。" }, { status: 400 }); update.rightsStatus = payload.rightsStatus; changed = true; }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb(); const [label] = await db.update(interpretationLabels).set(update).where(eq(interpretationLabels.id, id)).returning();
    return Response.json({ label });
  } catch (error) { return interpretationApiError(error, "保存作品标签失败，请稍后重试。"); }
}
