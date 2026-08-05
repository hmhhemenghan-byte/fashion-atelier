import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionDeliveryItems, type NewExhibitionDeliveryItem } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { EXHIBITION_DELIVERY_CHANNELS, EXHIBITION_DELIVERY_PROOF_STATUSES, getExhibitionDeliveryItem, getExhibitionDeliveryPackage, type ExhibitionDeliveryChannel, type ExhibitionDeliveryProofStatus } from "@/lib/exhibition-delivery";
import { cleanDeliveryText, deliveryApiError, normalizeDeliveryInteger } from "@/lib/exhibition-delivery-input";

type RouteContext = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params; const current = await getExhibitionDeliveryItem(id);
    if (!current) return Response.json({ error: "展览交付项不存在。" }, { status: 404 });
    const parent = await getExhibitionDeliveryPackage(current.exhibitionDeliveryPackageId);
    if (!parent) return Response.json({ error: "展览交付包不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(parent.status)) return Response.json({ error: "该交付包已经冻结。" }, { status: 409 });
    const payload = (await request.json()) as { channel?: ExhibitionDeliveryChannel; sequence?: number | string; title?: string; placement?: string; formatSpec?: string; proofStatus?: ExhibitionDeliveryProofStatus; proofNote?: string; handoffNote?: string };
    const update: Partial<NewExhibitionDeliveryItem> = { updatedAt: new Date().toISOString() }; let changed = false;
    if (payload.channel !== undefined) { if (!EXHIBITION_DELIVERY_CHANNELS.includes(payload.channel)) return Response.json({ error: "交付载体无效。" }, { status: 400 }); update.channel = payload.channel; changed = true; }
    if (payload.proofStatus !== undefined) { if (!EXHIBITION_DELIVERY_PROOF_STATUSES.includes(payload.proofStatus)) return Response.json({ error: "校样状态无效。" }, { status: 400 }); update.proofStatus = payload.proofStatus; changed = true; }
    if (payload.sequence !== undefined) { update.sequence = normalizeDeliveryInteger(payload.sequence, current.sequence); changed = true; }
    for (const [key, max] of [["title", 500], ["placement", 2000], ["formatSpec", 3000], ["proofNote", 4000], ["handoffNote", 4000]] as const) { if (payload[key] !== undefined) { update[key] = cleanDeliveryText(payload[key], max); changed = true; } }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb(); const [item] = await db.update(exhibitionDeliveryItems).set(update).where(eq(exhibitionDeliveryItems.id, id)).returning();
    return Response.json({ item });
  } catch (error) { return deliveryApiError(error, "保存展览交付项失败，请稍后重试。"); }
}
