import { getDb } from "@/db";
import { materials, type NewMaterial } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import {
  cleanMaterialText,
  materialApiError,
  materialCode,
} from "@/lib/material-input";
import {
  buildMaterialOverview,
  MATERIAL_CATEGORIES,
  MATERIAL_STATUSES,
  materialsToCsv,
  workMaterialsToCsv,
  type MaterialCategory,
  type MaterialStatus,
} from "@/lib/materials";
import { getBucket } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await buildMaterialOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "materials") {
      return csvResponse(
        materialsToCsv(overview),
        `nera-material-library-${date}.csv`,
      );
    }
    if (format === "bom") {
      return csvResponse(
        workMaterialsToCsv(overview),
        `nera-look-material-bom-${date}.csv`,
      );
    }
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-material-room-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return materialApiError(error, "无法读取材料室，请稍后重试。");
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
    const name = readText(form, "name", 240);
    if (!name) {
      return Response.json({ error: "请填写材料名称。" }, { status: 400 });
    }
    const category =
      (readText(form, "category", 40) || "fabric") as MaterialCategory;
    const status =
      (readText(form, "status", 40) || "research") as MaterialStatus;
    if (!MATERIAL_CATEGORIES.includes(category)) {
      return Response.json({ error: "材料类别无效。" }, { status: 400 });
    }
    if (!MATERIAL_STATUSES.includes(status)) {
      return Response.json({ error: "材料状态无效。" }, { status: 400 });
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    const image = form.get("swatchImage");
    const colorName = readText(form, "colorName", 160);
    let swatchImageType: string | null = null;
    let swatchImageSize: number | null = null;
    let swatchAltText = readText(form, "swatchAltText", 240);

    if (image instanceof File && image.size > 0) {
      const sizeError = imageSizeError(image);
      if (sizeError) {
        return Response.json({ error: sizeError }, { status: 400 });
      }
      const bytes = await image.arrayBuffer();
      const detected = detectImage(new Uint8Array(bytes));
      if (!detected) {
        return Response.json(
          { error: "材料色卡仅支持真实的 JPEG、PNG 或 WebP 图片。" },
          { status: 400 },
        );
      }
      if (!swatchAltText) {
        swatchAltText = `${name}${colorName ? `，${colorName}` : ""} 材料色卡`;
      }
      uploadedImageKey = `materials/${now.getUTCFullYear()}/${id}.${detected.extension}`;
      swatchImageType = detected.contentType;
      swatchImageSize = image.size;
      const bucket = await getBucket();
      await bucket.put(uploadedImageKey, bytes, {
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
    }

    const values: NewMaterial = {
      id,
      materialCode: materialCode(now),
      name,
      category,
      status,
      composition: readText(form, "composition", 500),
      construction: readText(form, "construction", 500),
      colorName,
      colorCode: readText(form, "colorCode", 120),
      supplierName: readText(form, "supplierName", 240),
      supplierReference: readText(form, "supplierReference", 180),
      origin: readText(form, "origin", 180),
      weight: readText(form, "weight", 120),
      width: readText(form, "width", 120),
      handFeel: readText(form, "handFeel", 500),
      finish: readText(form, "finish", 500),
      certifications: readText(form, "certifications", 800),
      swatchImageKey: uploadedImageKey,
      swatchImageType,
      swatchImageSize,
      swatchAltText,
      notes: readText(form, "notes", 4000),
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [material] = await db.insert(materials).values(values).returning();
    return Response.json({ material }, { status: 201 });
  } catch (error) {
    if (uploadedImageKey) {
      try {
        const bucket = await getBucket();
        await bucket.delete(uploadedImageKey);
      } catch {
        // Preserve the original failure response.
      }
    }
    return materialApiError(error, "建立材料档案失败，请稍后重试。");
  }
}

function readText(form: FormData, key: string, maxLength: number) {
  return cleanMaterialText(form.get(key), maxLength);
}

function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
