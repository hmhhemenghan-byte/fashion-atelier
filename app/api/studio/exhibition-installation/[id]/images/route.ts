import { getDb } from "@/db";
import { exhibitionInstallationImages, type NewExhibitionInstallationImage } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { EXHIBITION_INSTALLATION_IMAGE_ANGLES, getExhibitionInstallationGate, listAllExhibitionInstallationImages, type ExhibitionInstallationImageAngle } from "@/lib/exhibition-installation";
import { cleanInstallationText, installationApiError, installationInteger } from "@/lib/exhibition-installation-input";
import { detectImage, imageSizeError, safeOriginalName } from "@/lib/image-upload";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request); if (originError) return originError;
  const auth = await requireApiAdmin(); if (auth.response) return auth.response;
  let uploadedKey: string | null = null;
  try {
    const { id } = await context.params; const gate = await getExhibitionInstallationGate(id);
    if (!gate) return Response.json({ error: "展览装校签核不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(gate.status)) return Response.json({ error: "该装校事实已经冻结，不能新增证据。" }, { status: 409 });
    const existing = (await listAllExhibitionInstallationImages()).filter((image) => image.exhibitionInstallationGateId === id && image.status === "active");
    if (existing.length >= 16) return Response.json({ error: "每份装校签核最多保留 16 张有效证据。" }, { status: 409 });
    const form = await request.formData(); const image = form.get("image");
    if (!(image instanceof File) || image.size <= 0) return Response.json({ error: "请选择现场装校证据图片。" }, { status: 400 });
    const sizeError = imageSizeError(image); if (sizeError) return Response.json({ error: sizeError }, { status: 400 });
    const bytes = await image.arrayBuffer(); const detected = detectImage(new Uint8Array(bytes));
    if (!detected) return Response.json({ error: "证据仅支持真实的 JPEG、PNG 或 WebP 图片。" }, { status: 400 });
    const angle = (cleanInstallationText(form.get("angle"), 40) || "overview") as ExhibitionInstallationImageAngle;
    if (!EXHIBITION_INSTALLATION_IMAGE_ANGLES.includes(angle)) return Response.json({ error: "证据类型无效。" }, { status: 400 });
    const imageId = crypto.randomUUID(); const now = new Date(); const nowIso = now.toISOString();
    const altText = cleanInstallationText(form.get("altText"), 240) || `${gate.gateCode} ${angle} 私密现场装校证据`;
    uploadedKey = `exhibition-installation/${now.getUTCFullYear()}/${id}/${imageId}.${detected.extension}`;
    const bucket = await getBucket(); await bucket.put(uploadedKey, bytes, { httpMetadata: { contentType: detected.contentType, cacheControl: "private, no-store" }, customMetadata: { exhibitionInstallationGateId: id, uploadedBy: auth.user.email, originalName: safeOriginalName(image.name) } });
    const values: NewExhibitionInstallationImage = { id: imageId, exhibitionInstallationGateId: id, imageKey: uploadedKey, imageType: detected.contentType, imageSize: image.size, angle, caption: cleanInstallationText(form.get("caption"), 600), altText, status: "active", sortOrder: installationInteger(form.get("sortOrder"), existing.length), createdBy: auth.user.email, createdAt: nowIso, updatedAt: nowIso };
    const db = await getDb(); const [record] = await db.insert(exhibitionInstallationImages).values(values).returning();
    return Response.json({ image: record }, { status: 201 });
  } catch (error) {
    if (uploadedKey) { try { const bucket = await getBucket(); await bucket.delete(uploadedKey); } catch { /* Preserve original response. */ } }
    return installationApiError(error, "上传现场装校证据失败，请稍后重试。");
  }
}
