import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { samplePlacements } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import { getBucket } from "@/lib/runtime";
import { getSamplePlacementWorkspace } from "@/lib/sample-placements";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  let nextImageKey = "";
  try {
    const { id } = await context.params;
    const current = await getSamplePlacementWorkspace(id);
    if (!current) {
      return Response.json({ error: "成果记录不存在。" }, { status: 404 });
    }
    const form = await request.formData();
    const file = form.get("evidenceImage");
    if (!(file instanceof File)) {
      return Response.json({ error: "请选择证据图片。" }, { status: 400 });
    }
    const sizeError = imageSizeError(file);
    if (sizeError) return Response.json({ error: sizeError }, { status: 400 });
    const bytes = await file.arrayBuffer();
    const detected = detectImage(new Uint8Array(bytes));
    if (!detected) {
      return Response.json(
        { error: "证据图片仅支持真实的 JPEG、PNG 或 WebP。" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    nextImageKey = `placements/${now.slice(0, 4)}/${id}-${Date.now()}.${detected.extension}`;
    const bucket = await getBucket();
    await bucket.put(nextImageKey, bytes, {
      httpMetadata: {
        contentType: detected.contentType,
        cacheControl: "private, no-store",
      },
      customMetadata: {
        placementId: id,
        uploadedBy: auth.user.email,
        originalName: safeOriginalName(file.name),
      },
    });

    const altText = readText(form, "evidenceAltText", 240);
    const db = await getDb();
    try {
      await db
        .update(samplePlacements)
        .set({
          evidenceImageKey: nextImageKey,
          evidenceImageType: detected.contentType,
          evidenceImageSize: file.size,
          evidenceAltText:
            altText ||
            current.placement.evidenceAltText ||
            `${current.placement.title} 成果证据`,
          updatedAt: now,
        })
        .where(eq(samplePlacements.id, id));
    } catch (error) {
      await bucket.delete(nextImageKey);
      nextImageKey = "";
      throw error;
    }
    if (
      current.placement.evidenceImageKey &&
      current.placement.evidenceImageKey !== nextImageKey
    ) {
      try {
        await bucket.delete(current.placement.evidenceImageKey);
      } catch {
        // The replacement is already committed; stale object cleanup can retry later.
      }
    }
    return Response.json({
      placement: await getSamplePlacementWorkspace(id),
    });
  } catch {
    return Response.json(
      { error: "更新成果证据图片失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

function readText(form: FormData, key: string, maxLength: number) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
