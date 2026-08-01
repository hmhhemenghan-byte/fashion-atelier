import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { technicalPacks } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import { techPackApiError } from "@/lib/tech-pack-input";
import { getTechnicalPack } from "@/lib/technical-packs";
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
    const pack = await getTechnicalPack(id);
    if (!pack) {
      return Response.json({ error: "技术包不存在。" }, { status: 404 });
    }
    if (["approved", "locked"].includes(pack.status)) {
      return Response.json(
        { error: "已批准或锁定的技术包需先退回评审状态。" },
        { status: 409 },
      );
    }
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) {
      return Response.json({ error: "请选择技术图。" }, { status: 400 });
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
    const imageKey = `technical-packs/${new Date().getUTCFullYear()}/${id}-${crypto.randomUUID()}.${detected.extension}`;
    const bucket = await getBucket();
    await bucket.put(imageKey, bytes, {
      httpMetadata: {
        contentType: detected.contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        technicalPackId: id,
        uploadedBy: auth.user.email,
        originalName: safeOriginalName(image.name),
      },
    });

    try {
      const rawAltText = form.get("altText");
      const altText =
        typeof rawAltText === "string" && rawAltText.trim()
          ? rawAltText.trim().slice(0, 240)
          : pack.sketchAltText || `${pack.techPackCode} 技术图`;
      const db = await getDb();
      const [updated] = await db
        .update(technicalPacks)
        .set({
          sketchImageKey: imageKey,
          sketchImageType: detected.contentType,
          sketchImageSize: image.size,
          sketchAltText: altText,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(technicalPacks.id, id))
        .returning();
      if (pack.sketchImageKey) {
        await bucket.delete(pack.sketchImageKey);
      }
      return Response.json({ pack: updated });
    } catch (error) {
      await bucket.delete(imageKey);
      throw error;
    }
  } catch (error) {
    return techPackApiError(error, "替换技术图失败，请稍后重试。");
  }
}
