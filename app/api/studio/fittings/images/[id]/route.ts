import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  fittingImages,
  type NewFittingImage,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanFittingText,
  fittingApiError,
  fittingInteger,
} from "@/lib/fitting-input";
import {
  FITTING_IMAGE_ANGLES,
  FITTING_IMAGE_STATUSES,
  getFittingImage,
  getFittingSession,
  type FittingImageAngle,
  type FittingImageStatus,
} from "@/lib/fittings";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  angle?: FittingImageAngle;
  caption?: string;
  altText?: string;
  status?: FittingImageStatus;
  sortOrder?: number | string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getFittingImage(id);
    if (!current) {
      return Response.json({ error: "试身影像不存在。" }, { status: 404 });
    }
    const session = await getFittingSession(current.fittingSessionId);
    if (!session) {
      return Response.json({ error: "试身场次不存在。" }, { status: 404 });
    }
    if (["approved", "closed", "cancelled"].includes(session.status)) {
      return Response.json(
        { error: "该试身场次已冻结，不能修改影像记录。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewFittingImage> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.angle !== undefined) {
      if (!FITTING_IMAGE_ANGLES.includes(payload.angle)) {
        return Response.json({ error: "影像角度无效。" }, { status: 400 });
      }
      update.angle = payload.angle;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!FITTING_IMAGE_STATUSES.includes(payload.status)) {
        return Response.json({ error: "影像状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      changed = true;
    }
    if (payload.caption !== undefined) {
      update.caption = cleanFittingText(payload.caption, 600);
      changed = true;
    }
    if (payload.altText !== undefined) {
      const altText = cleanFittingText(payload.altText, 240);
      if (!altText) {
        return Response.json(
          { error: "图片描述不能为空。" },
          { status: 400 },
        );
      }
      update.altText = altText;
      changed = true;
    }
    if (payload.sortOrder !== undefined) {
      update.sortOrder = fittingInteger(payload.sortOrder);
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }
    const db = await getDb();
    const [image] = await db
      .update(fittingImages)
      .set(update)
      .where(eq(fittingImages.id, id))
      .returning();
    return Response.json({ image });
  } catch (error) {
    return fittingApiError(error, "更新试身影像失败，请稍后重试。");
  }
}
