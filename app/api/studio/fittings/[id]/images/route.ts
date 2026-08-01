import { getDb } from "@/db";
import {
  fittingImages,
  type NewFittingImage,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import {
  cleanFittingText,
  fittingApiError,
  fittingInteger,
} from "@/lib/fitting-input";
import {
  FITTING_IMAGE_ANGLES,
  getFittingSession,
  listAllFittingImages,
  type FittingImageAngle,
} from "@/lib/fittings";
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
    const session = await getFittingSession(id);
    if (!session) {
      return Response.json({ error: "试身场次不存在。" }, { status: 404 });
    }
    if (["approved", "closed", "cancelled"].includes(session.status)) {
      return Response.json(
        { error: "该试身场次已冻结，不能新增影像。" },
        { status: 409 },
      );
    }
    const existing = (await listAllFittingImages()).filter(
      (image) =>
        image.fittingSessionId === id && image.status === "active",
    );
    if (existing.length >= 12) {
      return Response.json(
        { error: "每个试身场次最多保留 12 张有效影像。" },
        { status: 409 },
      );
    }
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || image.size <= 0) {
      return Response.json({ error: "请选择试身影像。" }, { status: 400 });
    }
    const sizeError = imageSizeError(image);
    if (sizeError) {
      return Response.json({ error: sizeError }, { status: 400 });
    }
    const bytes = await image.arrayBuffer();
    const detected = detectImage(new Uint8Array(bytes));
    if (!detected) {
      return Response.json(
        { error: "试身影像仅支持真实的 JPEG、PNG 或 WebP 图片。" },
        { status: 400 },
      );
    }
    const angle =
      (cleanFittingText(form.get("angle"), 40) || "front") as FittingImageAngle;
    if (!FITTING_IMAGE_ANGLES.includes(angle)) {
      return Response.json({ error: "影像角度无效。" }, { status: 400 });
    }
    const imageId = crypto.randomUUID();
    const now = new Date();
    const timestamp = now.toISOString();
    const altText =
      cleanFittingText(form.get("altText"), 240) ||
      `${session.fittingCode} ${angle} 试身记录`;
    uploadedKey = `fittings/${now.getUTCFullYear()}/${id}/${imageId}.${detected.extension}`;
    const bucket = await getBucket();
    await bucket.put(uploadedKey, bytes, {
      httpMetadata: {
        contentType: detected.contentType,
        cacheControl: "private, no-store",
      },
      customMetadata: {
        fittingSessionId: id,
        uploadedBy: auth.user.email,
        originalName: safeOriginalName(image.name),
      },
    });
    const values: NewFittingImage = {
      id: imageId,
      fittingSessionId: id,
      imageKey: uploadedKey,
      imageType: detected.contentType,
      imageSize: image.size,
      angle,
      caption: cleanFittingText(form.get("caption"), 600),
      altText,
      status: "active",
      sortOrder: fittingInteger(form.get("sortOrder"), existing.length),
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [record] = await db
      .insert(fittingImages)
      .values(values)
      .returning();
    return Response.json({ image: record }, { status: 201 });
  } catch (error) {
    if (uploadedKey) {
      try {
        const bucket = await getBucket();
        await bucket.delete(uploadedKey);
      } catch {
        // Preserve the original failure response.
      }
    }
    return fittingApiError(error, "上传试身影像失败，请稍后重试。");
  }
}
