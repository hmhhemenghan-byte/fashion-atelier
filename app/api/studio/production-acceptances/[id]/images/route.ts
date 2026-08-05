import { getDb } from "@/db";
import {
  productionAcceptanceImages,
  type NewProductionAcceptanceImage,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { detectImage, imageSizeError, safeOriginalName } from "@/lib/image-upload";
import {
  cleanProductionAcceptanceText,
  productionAcceptanceApiError,
  productionAcceptanceInteger,
} from "@/lib/production-acceptance-input";
import {
  getProductionAcceptance,
  listAllProductionAcceptanceImages,
  PRODUCTION_ACCEPTANCE_IMAGE_ANGLES,
  type ProductionAcceptanceImageAngle,
} from "@/lib/production-acceptances";
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
    const acceptance = await getProductionAcceptance(id);
    if (!acceptance) {
      return Response.json({ error: "成衣验收记录不存在。" }, { status: 404 });
    }
    if (["accepted", "rejected", "void"].includes(acceptance.status)) {
      return Response.json(
        { error: "该验收事实已经冻结，不能新增证据。" },
        { status: 409 },
      );
    }
    const existing = (await listAllProductionAcceptanceImages()).filter(
      (image) =>
        image.productionAcceptanceId === id && image.status === "active",
    );
    if (existing.length >= 12) {
      return Response.json(
        { error: "每次成衣验收最多保留 12 张有效证据。" },
        { status: 409 },
      );
    }
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || image.size <= 0) {
      return Response.json({ error: "请选择成衣验收证据。" }, { status: 400 });
    }
    const sizeError = imageSizeError(image);
    if (sizeError) {
      return Response.json({ error: sizeError }, { status: 400 });
    }
    const bytes = await image.arrayBuffer();
    const detected = detectImage(new Uint8Array(bytes));
    if (!detected) {
      return Response.json(
        { error: "验收证据仅支持真实的 JPEG、PNG 或 WebP 图片。" },
        { status: 400 },
      );
    }
    const angle =
      (cleanProductionAcceptanceText(form.get("angle"), 40) ||
        "front") as ProductionAcceptanceImageAngle;
    if (!PRODUCTION_ACCEPTANCE_IMAGE_ANGLES.includes(angle)) {
      return Response.json({ error: "证据角度无效。" }, { status: 400 });
    }
    const imageId = crypto.randomUUID();
    const now = new Date();
    const nowIso = now.toISOString();
    const altText =
      cleanProductionAcceptanceText(form.get("altText"), 240) ||
      `${acceptance.acceptanceCode} ${angle} 成衣验收证据`;
    uploadedKey = `production-acceptances/${now.getUTCFullYear()}/${id}/${imageId}.${detected.extension}`;
    const bucket = await getBucket();
    await bucket.put(uploadedKey, bytes, {
      httpMetadata: {
        contentType: detected.contentType,
        cacheControl: "private, no-store",
      },
      customMetadata: {
        productionAcceptanceId: id,
        uploadedBy: auth.user.email,
        originalName: safeOriginalName(image.name),
      },
    });
    const values: NewProductionAcceptanceImage = {
      id: imageId,
      productionAcceptanceId: id,
      imageKey: uploadedKey,
      imageType: detected.contentType,
      imageSize: image.size,
      angle,
      caption: cleanProductionAcceptanceText(form.get("caption"), 600),
      altText,
      status: "active",
      sortOrder: productionAcceptanceInteger(form.get("sortOrder"), existing.length),
      createdBy: auth.user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const db = await getDb();
    const [record] = await db
      .insert(productionAcceptanceImages)
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
    return productionAcceptanceApiError(
      error,
      "上传成衣验收证据失败，请稍后重试。",
    );
  }
}
