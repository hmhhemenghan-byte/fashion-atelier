import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionReadinessImages, type NewExhibitionReadinessImage } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { cleanExhibitionText, exhibitionApiError, exhibitionInteger } from "@/lib/exhibition-readiness-input";
import {
  EXHIBITION_IMAGE_ANGLES,
  EXHIBITION_IMAGE_STATUSES,
  getExhibitionReadinessImage,
  getExhibitionReadinessPlan,
  type ExhibitionImageAngle,
  type ExhibitionImageStatus,
} from "@/lib/exhibition-readiness";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = { angle?: ExhibitionImageAngle; caption?: string; altText?: string; status?: ExhibitionImageStatus; sortOrder?: number | string };

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getExhibitionReadinessImage(id);
    if (!current) return Response.json({ error: "展陈证据不存在。" }, { status: 404 });
    const plan = await getExhibitionReadinessPlan(current.exhibitionReadinessPlanId);
    if (!plan) return Response.json({ error: "展陈方案不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(plan.status)) return Response.json({ error: "该展陈事实已经冻结，不能修改证据。" }, { status: 409 });
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewExhibitionReadinessImage> = { updatedAt: new Date().toISOString() };
    let changed = false;
    if (payload.angle !== undefined) {
      if (!EXHIBITION_IMAGE_ANGLES.includes(payload.angle)) return Response.json({ error: "证据类型无效。" }, { status: 400 });
      update.angle = payload.angle; changed = true;
    }
    if (payload.status !== undefined) {
      if (!EXHIBITION_IMAGE_STATUSES.includes(payload.status)) return Response.json({ error: "证据状态无效。" }, { status: 400 });
      update.status = payload.status; changed = true;
    }
    if (payload.caption !== undefined) { update.caption = cleanExhibitionText(payload.caption, 600); changed = true; }
    if (payload.altText !== undefined) {
      const altText = cleanExhibitionText(payload.altText, 240);
      if (!altText) return Response.json({ error: "图片描述不能为空。" }, { status: 400 });
      update.altText = altText; changed = true;
    }
    if (payload.sortOrder !== undefined) { update.sortOrder = exhibitionInteger(payload.sortOrder); changed = true; }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb();
    const [image] = await db.update(exhibitionReadinessImages).set(update)
      .where(eq(exhibitionReadinessImages.id, id)).returning();
    return Response.json({ image });
  } catch (error) {
    return exhibitionApiError(error, "更新展陈证据失败，请稍后重试。");
  }
}
