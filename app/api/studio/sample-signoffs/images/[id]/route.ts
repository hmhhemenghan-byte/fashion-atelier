import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleSignoffImages,
  type NewSampleSignoffImage,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanSampleSignoffText,
  sampleSignoffApiError,
  sampleSignoffInteger,
} from "@/lib/sample-signoff-input";
import {
  getSampleSignoff,
  getSampleSignoffImage,
  SAMPLE_SIGNOFF_IMAGE_ANGLES,
  SAMPLE_SIGNOFF_IMAGE_STATUSES,
  type SampleSignoffImageAngle,
  type SampleSignoffImageStatus,
} from "@/lib/sample-signoffs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  angle?: SampleSignoffImageAngle;
  caption?: string;
  altText?: string;
  status?: SampleSignoffImageStatus;
  sortOrder?: number | string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getSampleSignoffImage(id);
    if (!current) {
      return Response.json({ error: "封样证据不存在。" }, { status: 404 });
    }
    const signoff = await getSampleSignoff(current.sampleSignoffId);
    if (!signoff) {
      return Response.json({ error: "封样签核不存在。" }, { status: 404 });
    }
    if (["approved", "sealed", "void"].includes(signoff.status)) {
      return Response.json(
        { error: "该封样事实已冻结，不能修改证据。" },
        { status: 409 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const update: Partial<NewSampleSignoffImage> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.angle !== undefined) {
      if (!SAMPLE_SIGNOFF_IMAGE_ANGLES.includes(payload.angle)) {
        return Response.json({ error: "证据角度无效。" }, { status: 400 });
      }
      update.angle = payload.angle;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!SAMPLE_SIGNOFF_IMAGE_STATUSES.includes(payload.status)) {
        return Response.json({ error: "证据状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      changed = true;
    }
    if (payload.caption !== undefined) {
      update.caption = cleanSampleSignoffText(payload.caption, 600);
      changed = true;
    }
    if (payload.altText !== undefined) {
      const altText = cleanSampleSignoffText(payload.altText, 240);
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
      update.sortOrder = sampleSignoffInteger(payload.sortOrder);
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }
    const db = await getDb();
    const [image] = await db
      .update(sampleSignoffImages)
      .set(update)
      .where(eq(sampleSignoffImages.id, id))
      .returning();
    return Response.json({ image });
  } catch (error) {
    return sampleSignoffApiError(
      error,
      "更新封样证据失败，请稍后重试。",
    );
  }
}
