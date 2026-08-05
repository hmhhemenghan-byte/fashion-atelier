import { getDb } from "@/db";
import { exhibitionReadinessImages, type NewExhibitionReadinessImage } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { cleanExhibitionText, exhibitionApiError, exhibitionInteger } from "@/lib/exhibition-readiness-input";
import {
  EXHIBITION_IMAGE_ANGLES,
  getExhibitionReadinessPlan,
  listAllExhibitionReadinessImages,
  type ExhibitionImageAngle,
} from "@/lib/exhibition-readiness";
import { detectImage, imageSizeError, safeOriginalName } from "@/lib/image-upload";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;
  let uploadedKey: string | null = null;
  try {
    const { id } = await context.params;
    const plan = await getExhibitionReadinessPlan(id);
    if (!plan) return Response.json({ error: "展陈方案不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(plan.status)) return Response.json({ error: "该展陈事实已经冻结，不能新增证据。" }, { status: 409 });
    const existing = (await listAllExhibitionReadinessImages()).filter((image) => image.exhibitionReadinessPlanId === id && image.status === "active");
    if (existing.length >= 12) return Response.json({ error: "每份展陈方案最多保留 12 张有效证据。" }, { status: 409 });
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || image.size <= 0) return Response.json({ error: "请选择试装或环境证据图片。" }, { status: 400 });
    const sizeError = imageSizeError(image);
    if (sizeError) return Response.json({ error: sizeError }, { status: 400 });
    const bytes = await image.arrayBuffer();
    const detected = detectImage(new Uint8Array(bytes));
    if (!detected) return Response.json({ error: "证据仅支持真实的 JPEG、PNG 或 WebP 图片。" }, { status: 400 });
    const angle = (cleanExhibitionText(form.get("angle"), 40) || "overall") as ExhibitionImageAngle;
    if (!EXHIBITION_IMAGE_ANGLES.includes(angle)) return Response.json({ error: "证据类型无效。" }, { status: 400 });
    const imageId = crypto.randomUUID();
    const now = new Date();
    const nowIso = now.toISOString();
    const altText = cleanExhibitionText(form.get("altText"), 240) || `${plan.planCode} ${angle} 私密展陈证据`;
    uploadedKey = `exhibition-readiness/${now.getUTCFullYear()}/${id}/${imageId}.${detected.extension}`;
    const bucket = await getBucket();
    await bucket.put(uploadedKey, bytes, {
      httpMetadata: { contentType: detected.contentType, cacheControl: "private, no-store" },
      customMetadata: { exhibitionReadinessPlanId: id, uploadedBy: auth.user.email, originalName: safeOriginalName(image.name) },
    });
    const values: NewExhibitionReadinessImage = {
      id: imageId,
      exhibitionReadinessPlanId: id,
      imageKey: uploadedKey,
      imageType: detected.contentType,
      imageSize: image.size,
      angle,
      caption: cleanExhibitionText(form.get("caption"), 600),
      altText,
      status: "active",
      sortOrder: exhibitionInteger(form.get("sortOrder"), existing.length),
      createdBy: auth.user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const db = await getDb();
    const [record] = await db.insert(exhibitionReadinessImages).values(values).returning();
    return Response.json({ image: record }, { status: 201 });
  } catch (error) {
    if (uploadedKey) {
      try { const bucket = await getBucket(); await bucket.delete(uploadedKey); } catch { /* Preserve original response. */ }
    }
    return exhibitionApiError(error, "上传展陈证据失败，请稍后重试。");
  }
}
