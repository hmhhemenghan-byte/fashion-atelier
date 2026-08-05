import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionDeliveryPackages, type NewExhibitionDeliveryPackage } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { buildExhibitionDeliveryOverview, EXHIBITION_DELIVERY_DECISIONS, EXHIBITION_DELIVERY_STATUSES, exhibitionDeliveryMissingFields, getExhibitionDeliveryPackage, type ExhibitionDeliveryDecision, type ExhibitionDeliveryStatus } from "@/lib/exhibition-delivery";
import { cleanDeliveryText, deliveryApiError, normalizeDeliveryDateTime } from "@/lib/exhibition-delivery-input";

type RouteContext = { params: Promise<{ id: string }> };
type Payload = { status?: ExhibitionDeliveryStatus; decision?: ExhibitionDeliveryDecision; ownerName?: string; destination?: string; deliveryAt?: string | null; masterTitle?: string; formatStandard?: string; placementStandard?: string; accessibilityStandard?: string; rightsStandard?: string; handoffNote?: string; approvalNote?: string };
const transitions: Record<ExhibitionDeliveryStatus, ExhibitionDeliveryStatus[]> = { draft: ["draft", "in_review", "void"], in_review: ["in_review", "draft", "approved", "void"], approved: ["approved", "closed"], closed: ["closed"], void: ["void"] };

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params; const current = await getExhibitionDeliveryPackage(id);
    if (!current) return Response.json({ error: "展览交付包不存在。" }, { status: 404 });
    if (["closed", "void"].includes(current.status)) return Response.json({ error: "该交付事实已经冻结，不能改写。" }, { status: 409 });
    const payload = (await request.json()) as Payload;
    if (current.status === "approved" && (payload.status !== "closed" || Object.keys(payload).some((key) => key !== "status"))) return Response.json({ error: "已批准交付包只能关闭；新的交付定义请建立下一修订。" }, { status: 409 });
    const update: Partial<NewExhibitionDeliveryPackage> = { updatedAt: new Date().toISOString() }; let changed = false;
    for (const [key, max] of [["ownerName", 500], ["destination", 1000], ["masterTitle", 500], ["formatStandard", 4000], ["placementStandard", 4000], ["accessibilityStandard", 4000], ["rightsStandard", 4000], ["handoffNote", 5000], ["approvalNote", 5000]] as const) { if (payload[key] !== undefined) { update[key] = cleanDeliveryText(payload[key], max); changed = true; } }
    if (payload.deliveryAt !== undefined) { const value = normalizeDeliveryDateTime(payload.deliveryAt); if (payload.deliveryAt && !value) return Response.json({ error: "计划交付时间无效。" }, { status: 400 }); update.deliveryAt = value; changed = true; }
    if (payload.decision !== undefined) { if (!EXHIBITION_DELIVERY_DECISIONS.includes(payload.decision)) return Response.json({ error: "人工决定无效。" }, { status: 400 }); update.decision = payload.decision; changed = true; }
    if (payload.status !== undefined) {
      if (!EXHIBITION_DELIVERY_STATUSES.includes(payload.status) || !transitions[current.status].includes(payload.status)) return Response.json({ error: "交付状态转换无效。" }, { status: 409 });
      if (payload.status === "approved") {
        const overview = await buildExhibitionDeliveryOverview(); const workspace = overview.packages.find((item) => item.package.id === id);
        if (!workspace) return Response.json({ error: "无法核对展览交付包。" }, { status: 404 });
        const missing = exhibitionDeliveryMissingFields({ ...current, ...update }, workspace.items, workspace.summary.expectedKeys);
        if (missing.length || (update.decision ?? current.decision) !== "release") return Response.json({ error: `批准前仍需补齐：${missing.join("、") || "人工决定必须为放行"}。` }, { status: 409 });
        update.approvedBy = auth.user.email; update.approvedAt = new Date().toISOString();
      }
      if (payload.status === "closed") update.closedAt = new Date().toISOString(); update.status = payload.status; changed = true;
    }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb(); const [item] = await db.update(exhibitionDeliveryPackages).set(update).where(eq(exhibitionDeliveryPackages.id, id)).returning();
    return Response.json({ package: item });
  } catch (error) { return deliveryApiError(error, "保存展览交付包失败，请稍后重试。"); }
}
