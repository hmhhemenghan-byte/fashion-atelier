import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workProcessEntries } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; entryId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  let newKey: string | null = null;
  try {
    const { id: workId, entryId } = await context.params;
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || file.size <= 0) {
      return Response.json(
        { error: "请选择新的过程图片。" },
        { status: 400 },
      );
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
    const [current] = await db
      .select()
      .from(workProcessEntries)
      .where(
        and(
          eq(workProcessEntries.id, entryId),
          eq(workProcessEntries.workId, workId),
        ),
      )
      .limit(1);
    if (!current) {
      return Response.json({ error: "过程记录不存在。" }, { status: 404 });
    }

    const year = new Date().getUTCFullYear();
    newKey = `works/${year}/${workId}/process/${entryId}-${crypto.randomUUID()}.${detected.extension}`;
    const altText =
      readText(form, "altText", 240) || fileTitle(file.name) || current.title;
    const bucket = await getBucket();
    await bucket.put(newKey, bytes, {
      httpMetadata: {
        contentType: detected.contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        workId,
        entryId,
        uploadedBy: auth.user.email,
        originalName: safeOriginalName(file.name),
        role: "process",
      },
    });

    const [entry] = await db
      .update(workProcessEntries)
      .set({
        imageKey: newKey,
        imageType: detected.contentType,
        imageSize: file.size,
        altText,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(workProcessEntries.id, entryId),
          eq(workProcessEntries.workId, workId),
        ),
      )
      .returning();
    if (current.imageKey && current.imageKey !== newKey) {
      try {
        await bucket.delete(current.imageKey);
      } catch {
        // The new image is already authoritative; stale object cleanup is best-effort.
      }
    }
    return Response.json({ entry });
  } catch {
    if (newKey) {
      try {
        const bucket = await getBucket();
        await bucket.delete(newKey);
      } catch {
        // The database remains authoritative; orphan cleanup can be retried later.
      }
    }
    return Response.json(
      { error: "替换过程图片失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

function readText(form: FormData, key: string, maxLength: number) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function fileTitle(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240) || "过程记录图片"
  );
}
