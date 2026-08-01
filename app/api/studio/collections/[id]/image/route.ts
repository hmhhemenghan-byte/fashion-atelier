import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { collections } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return Response.json({ error: "请选择系列封面图片。" }, { status: 400 });
  }
  const sizeError = imageSizeError(file);
  if (sizeError) return Response.json({ error: sizeError }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const detected = detectImage(new Uint8Array(bytes));
  if (!detected) {
    return Response.json(
      { error: "仅支持真实的 JPEG、PNG 或 WebP 图片。" },
      { status: 400 },
    );
  }

  try {
    const db = await getDb();
    const [existing] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);
    if (!existing) {
      return Response.json({ error: "系列不存在。" }, { status: 404 });
    }

    const imageKey = `collections/${existing.year}/${id}-${crypto.randomUUID()}.${detected.extension}`;
    const bucket = await getBucket();
    await bucket.put(imageKey, bytes, {
      httpMetadata: {
        contentType: detected.contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        collectionId: id,
        uploadedBy: auth.user.email,
        originalName: safeOriginalName(file.name),
      },
    });

    try {
      const altText = form.get("altText");
      const [collection] = await db
        .update(collections)
        .set({
          heroImageKey: imageKey,
          heroImageType: detected.contentType,
          heroImageSize: file.size,
          heroAltText:
            typeof altText === "string" && altText.trim()
              ? altText.trim().slice(0, 240)
              : existing.heroAltText || existing.title,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(collections.id, id))
        .returning();

      if (existing.heroImageKey) await bucket.delete(existing.heroImageKey);
      return Response.json({ collection });
    } catch (error) {
      await bucket.delete(imageKey);
      throw error;
    }
  } catch {
    return Response.json(
      { error: "替换系列封面失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
