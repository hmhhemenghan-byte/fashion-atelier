import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionOpeningItems, type NewExhibitionOpeningItem } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { buildExhibitionOpeningOverview, EXHIBITION_OPENING_RESULTS, getExhibitionOpeningGate, getExhibitionOpeningItem, type ExhibitionOpeningResult } from "@/lib/exhibition-opening";
import { cleanOpeningText, openingApiError, openingInteger } from "@/lib/exhibition-opening-input";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = { exhibitionReadinessPlanId?: string | null; sequence?: number | string; result?: ExhibitionOpeningResult; displayLocation?: string; readinessNote?: string; handoverNote?: string };
export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError; const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try { const { id } = await context.params; const current = await getExhibitionOpeningItem(id); if (!current) return Response.json({ error: "作品开放核对项不存在。" }, { status: 404 }); const gate = await getExhibitionOpeningGate(current.exhibitionOpeningGateId); if (!gate) return Response.json({ error: "展览开放签核不存在。" }, { status: 404 }); if (["approved", "closed", "void"].includes(gate.status)) return Response.json({ error: "该开放事实已经冻结，不能修改作品核对。" }, { status: 409 });
    const payload = (await request.json()) as UpdatePayload; const update: Partial<NewExhibitionOpeningItem> = { updatedAt: new Date().toISOString() }; let changed = false;
    if (payload.sequence !== undefined) { update.sequence = openingInteger(payload.sequence, current.sequence); changed = true; } if (payload.result !== undefined) { if (!EXHIBITION_OPENING_RESULTS.includes(payload.result)) return Response.json({ error: "作品开放结果无效。" }, { status: 400 }); update.result = payload.result; changed = true; }
    for (const [key, maxLength] of [["displayLocation", 2400], ["readinessNote", 4000], ["handoverNote", 4000]] as const) if (payload[key] !== undefined) { update[key] = cleanOpeningText(payload[key], maxLength); changed = true; }
    if (payload.exhibitionReadinessPlanId !== undefined) { const planId = cleanOpeningText(payload.exhibitionReadinessPlanId, 120) || null; if (planId) { const overview = await buildExhibitionOpeningOverview(); const workspace = overview.gates.find((item) => item.gate.id === gate.id); const view = workspace?.items.find((item) => item.id === id); if (!view?.eligibleReadiness.some((plan) => plan.plan.id === planId)) return Response.json({ error: "只能关联同一实物的已批准展陈方案。" }, { status: 409 }); } update.exhibitionReadinessPlanId = planId; changed = true; }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 }); const db = await getDb(); const [item] = await db.update(exhibitionOpeningItems).set(update).where(eq(exhibitionOpeningItems.id, id)).returning(); return Response.json({ item });
  } catch (error) { return openingApiError(error, "保存作品开放核对失败，请稍后重试。"); }
}
