import { getDb } from "@/db";
import {
  sampleSignoffImages,
  type NewSampleSignoffImage,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import {
  cleanSampleSignoffText,
  sampleSignoffApiError,
  sampleSignoffInteger,
} from "@/lib/sample-signoff-input";
import {
  getSampleSignoff,
  listAllSampleSignoffImages,
  SAMPLE_SIGNOFF_IMAGE_ANGLES,
  type SampleSignoffImageAngle,
} from "@/lib/sample-signoffs";
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
    const signoff = await getSampleSignoff(id);
    if (!signoff) {
      return Response.json({ error: "封样签核不存在。" }, { status: 404 });
    }
    if (["approved", "sealed", "void"].includes(signoff.status)) {
      return Response.json(
        { error: "该封样事实已冻结，不能新增证据。" },
        { status: 409 },
      );
    }
    const existing = (await listAllSampleSignoffImages()).filter(
      (image) =>
        image.sampleSignoffId === id && image.status === "active",
    );
    if (existing.length >= 10) {
      return Response.json(
        { error: "每次封样签核最多保留 10 张有效证据。" },
        { status: 409 },
      );
    }
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || image.size <= 0) {
      return Response.json({ error: "请选择封样证据。" }, { status: 400 });
    }
    const sizeError = imageSizeError(image);
    if (sizeError) {
      return Response.json({ error: sizeError }, { status: 400 });
    }
    const bytes = await image.arrayBuffer();
    const detected = detectImage(new Uint8Array(bytes));
    if (!detected) {
      return Response.json(
        { error: "封样证据仅支持真实的 JPEG、PNG 或 WebP 图片。" },
        { status: 400 },
      );
    }
    const angle =
      (cleanSampleSignoffText(form.get("angle"), 40) ||
        "front") as SampleSignoffImageAngle;
    if (!SAMPLE_SIGNOFF_IMAGE_ANGLES.includes(angle)) {
      return Response.json({ error: "证据角度无效。" }, { status: 400 });
    }
    const imageId = crypto.randomUUID();
    const now = new Date();
    const nowIso = now.toISOString();
    const altText =
      cleanSampleSignoffText(form.get("altText"), 240) ||
      `${signoff.signoffCode} ${angle} 封样证据`;
    uploadedKey = `sample-signoffs/${now.getUTCFullYear()}/${id}/${imageId}.${detected.extension}`;
    const bucket = await getBucket();
    await bucket.put(uploadedKey, bytes, {
      httpMetadata: {
        contentType: detected.contentType,
        cacheControl: "private, no-store",
      },
      customMetadata: {
        sampleSignoffId: id,
        uploadedBy: auth.user.email,
        originalName: safeOriginalName(image.name),
      },
    });
    const values: NewSampleSignoffImage = {
      id: imageId,
      sampleSignoffId: id,
      imageKey: uploadedKey,
      imageType: detected.contentType,
      imageSize: image.size,
      angle,
      caption: cleanSampleSignoffText(form.get("caption"), 600),
      altText,
      status: "active",
      sortOrder: sampleSignoffInteger(
        form.get("sortOrder"),
        existing.length,
      ),
      createdBy: auth.user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const db = await getDb();
    const [record] = await db
      .insert(sampleSignoffImages)
      .values(values)
      .returning();
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
    return sampleSignoffApiError(
      error,
      "上传封样证据失败，请稍后重试。",
    );
  }
}
