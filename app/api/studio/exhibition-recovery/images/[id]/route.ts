import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionRecoveryImages, type NewExhibitionRecoveryImage } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { EXHIBITION_RECOVERY_IMAGE_ANGLES, EXHIBITION_RECOVERY_IMAGE_STATUSES, getExhibitionRecovery, getExhibitionRecoveryImage, type ExhibitionRecoveryImageAngle, type ExhibitionRecoveryImageStatus } from "@/lib/exhibition-recovery";
import { cleanRecoveryText, exhibitionRecoveryApiError, recoveryInteger } from "@/lib/exhibition-recovery-input";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  try {
    const { id } = await context.params; const current = await getExhibitionRecoveryImage(id);
    if (!current) return Response.json({ error: "展后复原证据不存在。" }, { status: 404 });
    const recovery = await getExhibitionRecovery(current.exhibitionRecoveryId);
    if (!recovery) return Response.json({ error: "展后复原记录不存在。" }, { status: 404 });
    if (["released", "referred", "void"].includes(recovery.status)) return Response.json({ error: "该复原事实已经冻结，不能修改证据。" }, { status: 409 });
    const payload = (await request.json()) as { angle?: ExhibitionRecoveryImageAngle; caption?: string; altText?: string; status?: ExhibitionRecoveryImageStatus; sortOrder?: number | string };
    const update: Partial<NewExhibitionRecoveryImage> = { updatedAt: new Date().toISOString() }; let changed = false;
    if (payload.angle !== undefined) { if (!EXHIBITION_RECOVERY_IMAGE_ANGLES.includes(payload.angle)) return Response.json({ error: "证据类型无效。" }, { status: 400 }); update.angle = payload.angle; changed = true; }
    if (payload.status !== undefined) { if (!EXHIBITION_RECOVERY_IMAGE_STATUSES.includes(payload.status)) return Response.json({ error: "证据状态无效。" }, { status: 400 }); update.status = payload.status; changed = true; }
    if (payload.caption !== undefined) { update.caption = cleanRecoveryText(payload.caption, 600); changed = true; }
    if (payload.altText !== undefined) { const value = cleanRecoveryText(payload.altText, 240); if (!value) return Response.json({ error: "图片描述不能为空。" }, { status: 400 }); update.altText = value; changed = true; }
    if (payload.sortOrder !== undefined) { update.sortOrder = recoveryInteger(payload.sortOrder); changed = true; }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb(); const [image] = await db.update(exhibitionRecoveryImages).set(update).where(eq(exhibitionRecoveryImages.id, id)).returning(); return Response.json({ image });
  } catch (error) { return exhibitionRecoveryApiError(error, "更新展后复原证据失败，请稍后重试。"); }
}
