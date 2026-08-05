import { getDb } from "@/db";
import { exhibitionWatchImages, type NewExhibitionWatchImage } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { WATCH_IMAGE_ANGLES, getExhibitionWatch, getExhibitionWatchObservation, listAllExhibitionWatchImages, type WatchImageAngle } from "@/lib/exhibition-watch";
import { cleanWatchText, exhibitionWatchApiError, watchInteger } from "@/lib/exhibition-watch-input";
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
    const watch = await getExhibitionWatch(id);
    if (!watch) return Response.json({ error: "展期监测记录不存在。" }, { status: 404 });
    if (watch.status === "closed") return Response.json({ error: "监测记录已关闭，不能新增证据。" }, { status: 409 });
    const existing = (await listAllExhibitionWatchImages()).filter((item) => item.exhibitionWatchId === id && item.status === "active");
    if (existing.length >= 20) return Response.json({ error: "每次展期监测最多保留 20 张有效证据。" }, { status: 409 });
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || image.size <= 0) return Response.json({ error: "请选择监测证据图片。" }, { status: 400 });
    const sizeError = imageSizeError(image);
    if (sizeError) return Response.json({ error: sizeError }, { status: 400 });
    const bytes = await image.arrayBuffer();
    const detected = detectImage(new Uint8Array(bytes));
    if (!detected) return Response.json({ error: "证据仅支持真实的 JPEG、PNG 或 WebP 图片。" }, { status: 400 });
    const angle = (cleanWatchText(form.get("angle"), 40) || "overall") as WatchImageAngle;
    if (!WATCH_IMAGE_ANGLES.includes(angle)) return Response.json({ error: "证据类型无效。" }, { status: 400 });
    const observationId = cleanWatchText(form.get("observationId"), 120) || null;
    if (observationId) {
      const observation = await getExhibitionWatchObservation(observationId);
      if (!observation || observation.exhibitionWatchId !== id) return Response.json({ error: "关联观察记录无效。" }, { status: 400 });
    }
    const imageId = crypto.randomUUID();
    const now = new Date();
    const nowIso = now.toISOString();
    const altText = cleanWatchText(form.get("altText"), 240) || `${watch.watchCode} ${angle} 展期监测证据`;
    uploadedKey = `exhibition-watch/${now.getUTCFullYear()}/${id}/${imageId}.${detected.extension}`;
    const bucket = await getBucket();
    await bucket.put(uploadedKey, bytes, { httpMetadata: { contentType: detected.contentType, cacheControl: "private, no-store" }, customMetadata: { exhibitionWatchId: id, uploadedBy: auth.user.email, originalName: safeOriginalName(image.name) } });
    const values: NewExhibitionWatchImage = {
      id: imageId, exhibitionWatchId: id, observationId, imageKey: uploadedKey, imageType: detected.contentType,
      imageSize: image.size, angle, caption: cleanWatchText(form.get("caption"), 600), altText,
      status: "active", sortOrder: watchInteger(form.get("sortOrder"), existing.length),
      createdBy: auth.user.email, createdAt: nowIso, updatedAt: nowIso,
    };
    const db = await getDb();
    const [record] = await db.insert(exhibitionWatchImages).values(values).returning();
    return Response.json({ image: record }, { status: 201 });
  } catch (error) {
    if (uploadedKey) {
      try { const bucket = await getBucket(); await bucket.delete(uploadedKey); } catch { /* preserve original error */ }
    }
    return exhibitionWatchApiError(error, "上传展期证据失败，请稍后重试。");
  }
}
