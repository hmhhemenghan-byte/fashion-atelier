import { getDb } from "@/db";
import { collections } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  listAllCollectionAssignments,
  listAllCollections,
  normalizeCollectionSlug,
} from "@/lib/collections";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const MAX_TEXT = {
  title: 120,
  subtitle: 160,
  season: 80,
  statement: 1600,
  heroAltText: 240,
};

export async function GET() {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const [collectionRows, assignments] = await Promise.all([
      listAllCollections(),
      listAllCollectionAssignments(),
    ]);
    return Response.json({ collections: collectionRows, assignments });
  } catch {
    return Response.json(
      { error: "系列数据库尚未初始化，请完成新版部署后再试。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  let uploadedImageKey: string | null = null;
  try {
    const form = await request.formData();
    const title = readText(form, "title", MAX_TEXT.title);
    const slug = normalizeCollectionSlug(
      readText(form, "slug", 80) || title,
    );
    const year = readYear(form.get("year"));
    if (!title || !slug) {
      return Response.json(
        { error: "系列名称和可用的网址标识为必填项。" },
        { status: 400 },
      );
    }
    if (!year) {
      return Response.json(
        { error: "请输入 1900–2100 之间的年份。" },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const hero = form.get("heroImage");
    let heroImageType: string | null = null;
    let heroImageSize: number | null = null;
    let heroAltText = readText(form, "heroAltText", MAX_TEXT.heroAltText);

    if (hero instanceof File && hero.size > 0) {
      const sizeError = imageSizeError(hero);
      if (sizeError) return Response.json({ error: sizeError }, { status: 400 });
      const bytes = await hero.arrayBuffer();
      const detected = detectImage(new Uint8Array(bytes));
      if (!detected) {
        return Response.json(
          { error: "系列封面仅支持真实的 JPEG、PNG 或 WebP 图片。" },
          { status: 400 },
        );
      }
      if (!heroAltText) heroAltText = title;
      uploadedImageKey = `collections/${year}/${id}.${detected.extension}`;
      heroImageType = detected.contentType;
      heroImageSize = hero.size;
      const bucket = await getBucket();
      await bucket.put(uploadedImageKey, bytes, {
        httpMetadata: {
          contentType: detected.contentType,
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: {
          collectionId: id,
          uploadedBy: auth.user.email,
          originalName: safeOriginalName(hero.name),
        },
      });
    }

    const db = await getDb();
    const [collection] = await db
      .insert(collections)
      .values({
        id,
        slug,
        title,
        subtitle: readText(form, "subtitle", MAX_TEXT.subtitle),
        season: readText(form, "season", MAX_TEXT.season),
        year,
        statement: readText(form, "statement", MAX_TEXT.statement),
        heroImageKey: uploadedImageKey,
        heroImageType,
        heroImageSize,
        heroAltText,
        sortOrder: readInteger(form.get("sortOrder")),
        createdBy: auth.user.email,
      })
      .returning();

    return Response.json({ collection }, { status: 201 });
  } catch (error) {
    if (uploadedImageKey) {
      try {
        const bucket = await getBucket();
        await bucket.delete(uploadedImageKey);
      } catch {
        // The original error remains the useful response.
      }
    }
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("UNIQUE")
          ? "该系列网址标识已存在，请换一个名称。"
          : "创建系列失败，请稍后重试。",
      },
      { status: 500 },
    );
  }
}

function readText(form: FormData, key: string, maxLength: number) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? Math.max(-9999, Math.min(9999, parsed))
    : 0;
}

function readYear(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2100
    ? parsed
    : null;
}
