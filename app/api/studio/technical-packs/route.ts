import { getDb } from "@/db";
import { technicalPacks, type NewTechnicalPack } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import { getBucket } from "@/lib/runtime";
import {
  cleanTechPackText,
  techPackApiError,
  techPackCode,
} from "@/lib/tech-pack-input";
import {
  buildTechnicalPackOverview,
  listAllTechnicalPacks,
  SAMPLE_STAGES,
  TECH_PACK_UNITS,
  techPackConstructionToCsv,
  techPackMeasurementsToCsv,
  technicalPacksToCsv,
  type SampleStage,
  type TechPackUnit,
} from "@/lib/technical-packs";
import { getWorkById } from "@/lib/works";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await buildTechnicalPackOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "packs") {
      return csvResponse(
        technicalPacksToCsv(overview),
        `nera-technical-packs-${date}.csv`,
      );
    }
    if (format === "measurements") {
      return csvResponse(
        techPackMeasurementsToCsv(overview),
        `nera-measurement-specs-${date}.csv`,
      );
    }
    if (format === "construction") {
      return csvResponse(
        techPackConstructionToCsv(overview),
        `nera-construction-notes-${date}.csv`,
      );
    }
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-technical-atelier-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return techPackApiError(
      error,
      "无法读取技术工艺室，请稍后重试。",
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
    const workId = readText(form, "workId", 120);
    if (!workId) {
      return Response.json({ error: "请选择对应的 Look。" }, { status: 400 });
    }
    const work = await getWorkById(workId);
    if (!work) {
      return Response.json({ error: "对应的 Look 不存在。" }, { status: 404 });
    }
    const sampleStage =
      (readText(form, "sampleStage", 40) || "concept") as SampleStage;
    const unit = (readText(form, "unit", 12) || "cm") as TechPackUnit;
    if (!SAMPLE_STAGES.includes(sampleStage)) {
      return Response.json({ error: "样衣阶段无效。" }, { status: 400 });
    }
    if (!TECH_PACK_UNITS.includes(unit)) {
      return Response.json({ error: "尺寸单位无效。" }, { status: 400 });
    }

    const existingPacks = await listAllTechnicalPacks();
    const revision =
      existingPacks
        .filter((pack) => pack.workId === workId)
        .reduce((latest, pack) => Math.max(latest, pack.revision), 0) + 1;
    const now = new Date();
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    const image = form.get("sketchImage");
    let sketchImageType: string | null = null;
    let sketchImageSize: number | null = null;
    let sketchAltText = readText(form, "sketchAltText", 240);

    if (image instanceof File && image.size > 0) {
      const sizeError = imageSizeError(image);
      if (sizeError) {
        return Response.json({ error: sizeError }, { status: 400 });
      }
      const bytes = await image.arrayBuffer();
      const detected = detectImage(new Uint8Array(bytes));
      if (!detected) {
        return Response.json(
          { error: "技术图仅支持真实的 JPEG、PNG 或 WebP 图片。" },
          { status: 400 },
        );
      }
      if (!sketchAltText) {
        sketchAltText = `${work.title} 第 ${revision} 版技术图`;
      }
      uploadedImageKey = `technical-packs/${now.getUTCFullYear()}/${id}.${detected.extension}`;
      sketchImageType = detected.contentType;
      sketchImageSize = image.size;
      const bucket = await getBucket();
      await bucket.put(uploadedImageKey, bytes, {
        httpMetadata: {
          contentType: detected.contentType,
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: {
          technicalPackId: id,
          workId,
          uploadedBy: auth.user.email,
          originalName: safeOriginalName(image.name),
        },
      });
    }

    const values: NewTechnicalPack = {
      id,
      techPackCode: techPackCode(work.lookNumber, revision, now),
      workId,
      revision,
      status: "draft",
      sampleStage,
      baseSize: readText(form, "baseSize", 80),
      unit,
      fitIntent: readText(form, "fitIntent", 1200),
      patternReference: readText(form, "patternReference", 240),
      constructionSummary: readText(form, "constructionSummary", 2000),
      gradingNotes: readText(form, "gradingNotes", 2000),
      finishingNotes: readText(form, "finishingNotes", 2000),
      labelNotes: readText(form, "labelNotes", 1200),
      packagingNotes: readText(form, "packagingNotes", 1200),
      sketchImageKey: uploadedImageKey,
      sketchImageType,
      sketchImageSize,
      sketchAltText,
      approvalNote: "",
      approvedBy: "",
      approvedAt: null,
      notes: readText(form, "notes", 4000),
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [pack] = await db.insert(technicalPacks).values(values).returning();
    return Response.json({ pack }, { status: 201 });
  } catch (error) {
    if (uploadedImageKey) {
      try {
        const bucket = await getBucket();
        await bucket.delete(uploadedImageKey);
      } catch {
        // Preserve the original failure response.
      }
    }
    return techPackApiError(error, "建立技术包失败，请稍后重试。");
  }
}

function readText(form: FormData, key: string, maxLength: number) {
  return cleanTechPackText(form.get(key), maxLength);
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
