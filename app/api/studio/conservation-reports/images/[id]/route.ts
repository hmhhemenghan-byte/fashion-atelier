import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  conservationReportImages,
  type NewConservationReportImage,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanConservationText,
  conservationApiError,
  conservationInteger,
} from "@/lib/conservation-input";
import {
  CONSERVATION_IMAGE_ANGLES,
  CONSERVATION_IMAGE_STATUSES,
  getConservationReport,
  getConservationReportImage,
  type ConservationImageAngle,
  type ConservationImageStatus,
} from "@/lib/conservation-reports";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  angle?: ConservationImageAngle;
  caption?: string;
  altText?: string;
  status?: ConservationImageStatus;
  sortOrder?: number | string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const current = await getConservationReportImage(id);
    if (!current) return Response.json({ error: "养护证据不存在。" }, { status: 404 });
    const report = await getConservationReport(current.conservationReportId);
    if (!report) return Response.json({ error: "养护报告不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(report.status)) {
      return Response.json({ error: "该养护事实已经冻结，不能修改证据。" }, { status: 409 });
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewConservationReportImage> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.angle !== undefined) {
      if (!CONSERVATION_IMAGE_ANGLES.includes(payload.angle)) {
        return Response.json({ error: "证据角度无效。" }, { status: 400 });
      }
      update.angle = payload.angle;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!CONSERVATION_IMAGE_STATUSES.includes(payload.status)) {
        return Response.json({ error: "证据状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      changed = true;
    }
    if (payload.caption !== undefined) {
      update.caption = cleanConservationText(payload.caption, 600);
      changed = true;
    }
    if (payload.altText !== undefined) {
      const altText = cleanConservationText(payload.altText, 240);
      if (!altText) return Response.json({ error: "图片描述不能为空。" }, { status: 400 });
      update.altText = altText;
      changed = true;
    }
    if (payload.sortOrder !== undefined) {
      update.sortOrder = conservationInteger(payload.sortOrder);
      changed = true;
    }
    if (!changed) return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    const db = await getDb();
    const [image] = await db
      .update(conservationReportImages)
      .set(update)
      .where(eq(conservationReportImages.id, id))
      .returning();
    return Response.json({ image });
  } catch (error) {
    return conservationApiError(error, "更新养护证据失败，请稍后重试。");
  }
}
