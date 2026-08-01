import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { materials } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import { materialApiError } from "@/lib/material-input";
import { getMaterial } from "@/lib/materials";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const material = await getMaterial(id);
    if (!material) {
      return Response.json({ error: "材料档案不存在。" }, { status: 404 });
    }
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) {
      return Response.json({ error: "请选择材料色卡图片。" }, { status: 400 });
    }
    const sizeError = imageSizeError(image);
    if (sizeError) {
      return Response.json({ error: sizeError }, { status: 400 });
    }
    const bytes = await image.arrayBuffer();
    const detected = detectImage(new Uint8Array(bytes));
    if (!detected) {
      return Response.json(
        { error: "仅支持真实的 JPEG、PNG 或 WebP 图片。" },
        { status: 400 },
      );
    }

    const imageKey = `materials/${new Date().getUTCFullYear()}/${id}-${crypto.randomUUID()}.${detected.extension}`;
    const bucket = await getBucket();
    await bucket.put(imageKey, bytes, {
      httpMetadata: {
        contentType: detected.contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        materialId: id,
        uploadedBy: auth.user.email,
        originalName: safeOriginalName(image.name),
      },
    });

    try {
      const rawAltText = form.get("altText");
      const altText =
        typeof rawAltText === "string" && rawAltText.trim()
          ? rawAltText.trim().slice(0, 240)
          : material.swatchAltText || `${material.name} 材料色卡`;
      const db = await getDb();
      const [updated] = await db
        .update(materials)
        .set({
          swatchImageKey: imageKey,
          swatchImageType: detected.contentType,
          swatchImageSize: image.size,
          swatchAltText: altText,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(materials.id, id))
        .returning();
      if (material.swatchImageKey) {
        await bucket.delete(material.swatchImageKey);
      }
      return Response.json({ material: updated });
    } catch (error) {
      await bucket.delete(imageKey);
      throw error;
    }
  } catch (error) {
    return materialApiError(error, "替换材料色卡失败，请稍后重试。");
  }
}
