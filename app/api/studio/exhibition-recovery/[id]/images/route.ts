import { getDb } from "@/db";
import { exhibitionRecoveryImages, type NewExhibitionRecoveryImage } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { EXHIBITION_RECOVERY_IMAGE_ANGLES, getExhibitionRecovery, listAllExhibitionRecoveryImages, type ExhibitionRecoveryImageAngle } from "@/lib/exhibition-recovery";
import { cleanRecoveryText, exhibitionRecoveryApiError, recoveryInteger } from "@/lib/exhibition-recovery-input";
import { detectImage, imageSizeError, safeOriginalName } from "@/lib/image-upload";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  let uploadedKey: string | null = null;
  try {
    const { id } = await context.params;
    const recovery = await getExhibitionRecovery(id);
    if (!recovery) return Response.json({ error: "展后复原记录不存在。" }, { status: 404 });
    if (["released", "referred", "void"].includes(recovery.status)) return Response.json({ error: "该复原事实已经冻结，不能新增证据。" }, { status: 409 });
    const existing = (await listAllExhibitionRecoveryImages()).filter((item) => item.exhibitionRecoveryId === id && item.status === "active");
    if (existing.length >= 12) return Response.json({ error: "每次展后复原最多保留 12 张有效证据。" }, { status: 409 });
    const form = await request.formData(); const image = form.get("image");
    if (!(image instanceof File) || image.size <= 0) return Response.json({ error: "请选择复原证据图片。" }, { status: 400 });
    const sizeError = imageSizeError(image); if (sizeError) return Response.json({ error: sizeError }, { status: 400 });
    const bytes = await image.arrayBuffer(); const detected = detectImage(new Uint8Array(bytes));
    if (!detected) return Response.json({ error: "证据仅支持真实的 JPEG、PNG 或 WebP 图片。" }, { status: 400 });
    const angle = (cleanRecoveryText(form.get("angle"), 40) || "intake") as ExhibitionRecoveryImageAngle;
    if (!EXHIBITION_RECOVERY_IMAGE_ANGLES.includes(angle)) return Response.json({ error: "证据类型无效。" }, { status: 400 });
    const imageId = crypto.randomUUID(); const now = new Date(); const nowIso = now.toISOString();
    const altText = cleanRecoveryText(form.get("altText"), 240) || `${recovery.recoveryCode} ${angle} 展后复原证据`;
    uploadedKey = `exhibition-recovery/${now.getUTCFullYear()}/${id}/${imageId}.${detected.extension}`;
    const bucket = await getBucket();
    await bucket.put(uploadedKey, bytes, { httpMetadata: { contentType: detected.contentType, cacheControl: "private, no-store" }, customMetadata: { exhibitionRecoveryId: id, uploadedBy: auth.user.email, originalName: safeOriginalName(image.name) } });
    const values: NewExhibitionRecoveryImage = { id: imageId, exhibitionRecoveryId: id, imageKey: uploadedKey, imageType: detected.contentType, imageSize: image.size, angle, caption: cleanRecoveryText(form.get("caption"), 600), altText, status: "active", sortOrder: recoveryInteger(form.get("sortOrder"), existing.length), createdBy: auth.user.email, createdAt: nowIso, updatedAt: nowIso };
    const db = await getDb(); const [record] = await db.insert(exhibitionRecoveryImages).values(values).returning();
    return Response.json({ image: record }, { status: 201 });
  } catch (error) {
    if (uploadedKey) { try { const bucket = await getBucket(); await bucket.delete(uploadedKey); } catch { /* preserve original error */ } }
    return exhibitionRecoveryApiError(error, "上传展后复原证据失败，请稍后重试。");
  }
}
