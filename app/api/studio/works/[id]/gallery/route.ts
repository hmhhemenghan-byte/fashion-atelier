import { asc, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workImages, works } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const MAX_GALLERY_IMAGES = 12;
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    const db = await getDb();
    const images = await db
      .select()
      .from(workImages)
      .where(eq(workImages.workId, id))
      .orderBy(asc(workImages.sortOrder), asc(workImages.createdAt));
    return Response.json({ images });
  } catch {
    return Response.json({ error: "读取细节图失败，请稍后重试。" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id: workId } = await context.params;
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return Response.json({ error: "请选择需要添加的细节图。" }, { status: 400 });
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
    const [work] = await db
      .select({ id: works.id })
      .from(works)
      .where(eq(works.id, workId))
      .limit(1);
    if (!work) return Response.json({ error: "作品不存在。" }, { status: 404 });

    const [galleryCount] = await db
      .select({ value: count() })
      .from(workImages)
      .where(eq(workImages.workId, workId));
    if ((galleryCount?.value ?? 0) >= MAX_GALLERY_IMAGES) {
      return Response.json(
        { error: `每件作品最多添加 ${MAX_GALLERY_IMAGES} 张细节图。` },
        { status: 400 },
      );
    }

    const imageId = crypto.randomUUID();
    const year = new Date().getUTCFullYear();
    const imageKey = `works/${year}/${workId}/gallery/${imageId}.${detected.extension}`;
    const label = readText(form, "label", 40) || `DETAIL ${String((galleryCount?.value ?? 0) + 1).padStart(2, "0")}`;
    const altText = readText(form, "altText", 240) || fileTitle(file.name);
    const sortOrder = readInteger(form, "sortOrder", galleryCount?.value ?? 0);
    const bucket = await getBucket();

    await bucket.put(imageKey, bytes, {
      httpMetadata: {
        contentType: detected.contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        workId,
        imageId,
        uploadedBy: auth.user.email,
        originalName: safeOriginalName(file.name),
        role: "gallery",
      },
    });

    try {
      const [image] = await db
        .insert(workImages)
        .values({
          id: imageId,
          workId,
          imageKey,
          imageType: detected.contentType,
          imageSize: file.size,
          label,
          altText,
          sortOrder,
          createdBy: auth.user.email,
        })
        .returning();
      return Response.json({ image }, { status: 201 });
    } catch (error) {
      await bucket.delete(imageKey);
      throw error;
    }
  } catch {
    return Response.json({ error: "添加细节图失败，请稍后重试。" }, { status: 500 });
  }
}

function readText(form: FormData, key: string, maxLength: number) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readInteger(form: FormData, key: string, fallback: number) {
  const value = form.get(key);
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(-9999, Math.min(9999, parsed)) : fallback;
}

function fileTitle(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240) || "作品细节图"
  );
}
