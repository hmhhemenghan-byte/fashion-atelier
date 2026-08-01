import { getDb } from "@/db";
import { works } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import { getBucket } from "@/lib/runtime";
import { listAllWorks } from "@/lib/works";

export const dynamic = "force-dynamic";

const MAX_TEXT = {
  title: 120,
  collection: 120,
  lookNumber: 40,
  description: 1000,
  altText: 240,
};

export async function GET() {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    return Response.json({ works: await listAllWorks() });
  } catch (error) {
    return storageError(error);
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return Response.json({ error: "请选择需要上传的图片。" }, { status: 400 });
    }
    const sizeError = imageSizeError(file);
    if (sizeError) return Response.json({ error: sizeError }, { status: 400 });

    const title = readText(form, "title", MAX_TEXT.title);
    const altText = readText(form, "altText", MAX_TEXT.altText);
    if (!title || !altText) {
      return Response.json(
        { error: "作品名称和图片描述为必填项。" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const detected = detectImage(new Uint8Array(bytes));
    if (!detected) {
      return Response.json(
        { error: "仅支持真实的 JPEG、PNG 或 WebP 图片。" },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const year = new Date().getUTCFullYear();
    const imageKey = `works/${year}/${id}.${detected.extension}`;
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
      },
    });

    try {
      const db = await getDb();
      const [work] = await db
        .insert(works)
        .values({
          id,
          title,
          collection:
            readText(form, "collection", MAX_TEXT.collection) ||
            "SECOND SKIN / AW 2027",
          lookNumber: readText(form, "lookNumber", MAX_TEXT.lookNumber),
          description: readText(form, "description", MAX_TEXT.description),
          altText,
          imageKey,
          imageType: detected.contentType,
          imageSize: file.size,
          sortOrder: readInteger(form, "sortOrder"),
          createdBy: auth.user.email,
        })
        .returning();

      return Response.json({ work }, { status: 201 });
    } catch (error) {
      await bucket.delete(imageKey);
      throw error;
    }
  } catch (error) {
    return storageError(error);
  }
}

function readText(form: FormData, key: string, maxLength: number): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readInteger(form: FormData, key: string): number {
  const value = form.get(key);
  if (typeof value !== "string") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(-9999, Math.min(9999, parsed)) : 0;
}

function storageError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const userMessage = message.includes("no such table")
    ? "作品数据库尚未初始化，请完成部署后再试。"
    : "作品保存失败，请稍后重试。";
  return Response.json({ error: userMessage }, { status: 500 });
}
