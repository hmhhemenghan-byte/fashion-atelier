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
  getConservationReport,
  listAllConservationReportImages,
  type ConservationImageAngle,
} from "@/lib/conservation-reports";
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
    const report = await getConservationReport(id);
    if (!report) return Response.json({ error: "养护报告不存在。" }, { status: 404 });
    if (["approved", "closed", "void"].includes(report.status)) {
      return Response.json({ error: "该养护事实已经冻结，不能新增证据。" }, { status: 409 });
    }
    const existing = (await listAllConservationReportImages()).filter(
      (image) => image.conservationReportId === id && image.status === "active",
    );
    if (existing.length >= 12) {
      return Response.json({ error: "每份养护报告最多保留 12 张有效证据。" }, { status: 409 });
    }
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || image.size <= 0) {
      return Response.json({ error: "请选择状态证据图片。" }, { status: 400 });
    }
    const sizeError = imageSizeError(image);
    if (sizeError) return Response.json({ error: sizeError }, { status: 400 });
    const bytes = await image.arrayBuffer();
    const detected = detectImage(new Uint8Array(bytes));
    if (!detected) {
      return Response.json({ error: "状态证据仅支持真实的 JPEG、PNG 或 WebP 图片。" }, { status: 400 });
    }
    const angle = (cleanConservationText(form.get("angle"), 40) || "overall") as ConservationImageAngle;
    if (!CONSERVATION_IMAGE_ANGLES.includes(angle)) {
      return Response.json({ error: "证据角度无效。" }, { status: 400 });
    }
    const imageId = crypto.randomUUID();
    const now = new Date();
    const nowIso = now.toISOString();
    const altText =
      cleanConservationText(form.get("altText"), 240) ||
      `${report.reportCode} ${angle} 作品状态证据`;
    uploadedKey = `conservation-reports/${now.getUTCFullYear()}/${id}/${imageId}.${detected.extension}`;
    const bucket = await getBucket();
    await bucket.put(uploadedKey, bytes, {
      httpMetadata: {
        contentType: detected.contentType,
        cacheControl: "private, no-store",
      },
      customMetadata: {
        conservationReportId: id,
        uploadedBy: auth.user.email,
        originalName: safeOriginalName(image.name),
      },
    });
    const values: NewConservationReportImage = {
      id: imageId,
      conservationReportId: id,
      imageKey: uploadedKey,
      imageType: detected.contentType,
      imageSize: image.size,
      angle,
      caption: cleanConservationText(form.get("caption"), 600),
      altText,
      status: "active",
      sortOrder: conservationInteger(form.get("sortOrder"), existing.length),
      createdBy: auth.user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const db = await getDb();
    const [record] = await db.insert(conservationReportImages).values(values).returning();
    return Response.json({ image: record }, { status: 201 });
  } catch (error) {
    if (uploadedKey) {
      try {
        const bucket = await getBucket();
        await bucket.delete(uploadedKey);
      } catch {
        // Preserve the original response.
      }
    }
    return conservationApiError(error, "上传养护证据失败，请稍后重试。");
  }
}
