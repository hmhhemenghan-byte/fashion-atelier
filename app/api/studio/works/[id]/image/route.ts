import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { works } from "@/db/schema";
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

  try {
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return Response.json({ error: "请选择新的作品图片。" }, { status: 400 });
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

    const db = await getDb();
    const [currentWork] = await db
      .select()
      .from(works)
      .where(eq(works.id, id))
      .limit(1);
    if (!currentWork) {
      return Response.json({ error: "作品不存在。" }, { status: 404 });
    }

    const year = new Date().getUTCFullYear();
    const imageKey = `works/${year}/${id}-rev-${crypto.randomUUID()}.${detected.extension}`;
    const bucket = await getBucket();

    await bucket.put(imageKey, bytes, {
      httpMetadata: {
        contentType: detected.contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        workId: id,
        uploadedBy: auth.user.email,
        originalName: safeOriginalName(file.name),
        replacement: "true",
      },
    });

    try {
      const [work] = await db
        .update(works)
        .set({
          imageKey,
          imageType: detected.contentType,
          imageSize: file.size,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(works.id, id))
        .returning();

      if (!work) {
        await bucket.delete(imageKey);
        return Response.json({ error: "作品不存在。" }, { status: 404 });
      }

      try {
        await bucket.delete(currentWork.imageKey);
      } catch {
        // The database already points at the new image. A stale, inaccessible
        // object is safer than rolling the work back to an outdated image.
      }

      return Response.json({ work });
    } catch (error) {
      await bucket.delete(imageKey);
      throw error;
    }
  } catch {
    return Response.json({ error: "替换图片失败，请稍后重试。" }, { status: 500 });
  }
}
