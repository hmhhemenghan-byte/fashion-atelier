import { asc, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workProcessEntries, works } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import { isProcessStage } from "@/lib/process-stages";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const MAX_PROCESS_ENTRIES = 24;
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  const { id: workId } = await context.params;
  try {
    const db = await getDb();
    const entries = await db
      .select()
      .from(workProcessEntries)
      .where(eq(workProcessEntries.workId, workId))
      .orderBy(
        asc(workProcessEntries.sortOrder),
        asc(workProcessEntries.createdAt),
      );
    return Response.json({ entries });
  } catch {
    return Response.json(
      { error: "读取过程档案失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  let uploadedKey: string | null = null;
  try {
    const { id: workId } = await context.params;
    const form = await request.formData();
    const title = readText(form, "title", 120);
    const requestedStage = form.get("stage");
    if (!title) {
      return Response.json({ error: "阶段标题不能为空。" }, { status: 400 });
    }
    if (!isProcessStage(requestedStage)) {
      return Response.json({ error: "请选择有效的过程阶段。" }, { status: 400 });
    }

    const db = await getDb();
    const [work] = await db
      .select({ id: works.id })
      .from(works)
      .where(eq(works.id, workId))
      .limit(1);
    if (!work) return Response.json({ error: "作品不存在。" }, { status: 404 });

    const [entryCount] = await db
      .select({ value: count() })
      .from(workProcessEntries)
      .where(eq(workProcessEntries.workId, workId));
    if ((entryCount?.value ?? 0) >= MAX_PROCESS_ENTRIES) {
      return Response.json(
        { error: `每件作品最多添加 ${MAX_PROCESS_ENTRIES} 条过程记录。` },
        { status: 400 },
      );
    }

    const entryId = crypto.randomUUID();
    const file = form.get("image");
    let imageType: string | null = null;
    let imageSize: number | null = null;
    let altText = readText(form, "altText", 240);

    if (file instanceof File && file.size > 0) {
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

      const year = new Date().getUTCFullYear();
      uploadedKey = `works/${year}/${workId}/process/${entryId}.${detected.extension}`;
      imageType = detected.contentType;
      imageSize = file.size;
      altText = altText || fileTitle(file.name) || title;

      const bucket = await getBucket();
      await bucket.put(uploadedKey, bytes, {
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
    }

    const status =
      form.get("status") === "published" ? "published" : "draft";
    const now = new Date().toISOString();
    const [entry] = await db
      .insert(workProcessEntries)
      .values({
        id: entryId,
        workId,
        stage: requestedStage,
        title,
        notes: readText(form, "notes", 3000),
        dateLabel: readText(form, "dateLabel", 80),
        imageKey: uploadedKey,
        imageType,
        imageSize,
        altText,
        status,
        sortOrder: readInteger(form, "sortOrder", entryCount?.value ?? 0),
        createdBy: auth.user.email,
        publishedAt: status === "published" ? now : null,
      })
      .returning();
    return Response.json({ entry }, { status: 201 });
  } catch {
    if (uploadedKey) {
      try {
        const bucket = await getBucket();
        await bucket.delete(uploadedKey);
      } catch {
        // The database remains authoritative; orphan cleanup can be retried later.
      }
    }
    return Response.json(
      { error: "添加过程记录失败，请稍后重试。" },
      { status: 500 },
    );
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
  return Number.isFinite(parsed)
    ? Math.max(-9999, Math.min(9999, parsed))
    : fallback;
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
