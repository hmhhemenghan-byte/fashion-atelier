import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  productionAcceptanceImages,
  type NewProductionAcceptanceImage,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanProductionAcceptanceText,
  productionAcceptanceApiError,
  productionAcceptanceInteger,
} from "@/lib/production-acceptance-input";
import {
  getProductionAcceptance,
  getProductionAcceptanceImage,
  PRODUCTION_ACCEPTANCE_IMAGE_ANGLES,
  PRODUCTION_ACCEPTANCE_IMAGE_STATUSES,
  type ProductionAcceptanceImageAngle,
  type ProductionAcceptanceImageStatus,
} from "@/lib/production-acceptances";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  angle?: ProductionAcceptanceImageAngle;
  caption?: string;
  altText?: string;
  status?: ProductionAcceptanceImageStatus;
  sortOrder?: number | string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getProductionAcceptanceImage(id);
    if (!current) {
      return Response.json({ error: "成衣验收证据不存在。" }, { status: 404 });
    }
    const acceptance = await getProductionAcceptance(
      current.productionAcceptanceId,
    );
    if (!acceptance) {
      return Response.json({ error: "成衣验收记录不存在。" }, { status: 404 });
    }
    if (["accepted", "rejected", "void"].includes(acceptance.status)) {
      return Response.json(
        { error: "该验收事实已经冻结，不能修改证据。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewProductionAcceptanceImage> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.angle !== undefined) {
      if (!PRODUCTION_ACCEPTANCE_IMAGE_ANGLES.includes(payload.angle)) {
        return Response.json({ error: "证据角度无效。" }, { status: 400 });
      }
      update.angle = payload.angle;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!PRODUCTION_ACCEPTANCE_IMAGE_STATUSES.includes(payload.status)) {
        return Response.json({ error: "证据状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      changed = true;
    }
    if (payload.caption !== undefined) {
      update.caption = cleanProductionAcceptanceText(payload.caption, 600);
      changed = true;
    }
    if (payload.altText !== undefined) {
      const altText = cleanProductionAcceptanceText(payload.altText, 240);
      if (!altText) {
        return Response.json({ error: "图片描述不能为空。" }, { status: 400 });
      }
      update.altText = altText;
      changed = true;
    }
    if (payload.sortOrder !== undefined) {
      update.sortOrder = productionAcceptanceInteger(payload.sortOrder);
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }
    const db = await getDb();
    const [image] = await db
      .update(productionAcceptanceImages)
      .set(update)
      .where(eq(productionAcceptanceImages.id, id))
      .returning();
    return Response.json({ image });
  } catch (error) {
    return productionAcceptanceApiError(
      error,
      "更新成衣验收证据失败，请稍后重试。",
    );
  }
}
