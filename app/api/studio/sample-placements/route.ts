import { getDb } from "@/db";
import {
  samplePlacementItems,
  samplePlacements,
  type NewSamplePlacement,
  type NewSamplePlacementItem,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  detectImage,
  imageSizeError,
  safeOriginalName,
} from "@/lib/image-upload";
import { getBucket } from "@/lib/runtime";
import { getSampleLoanWorkspace } from "@/lib/sample-loans";
import {
  buildSamplePlacementOverview,
  getSamplePlacementWorkspace,
  SAMPLE_PLACEMENT_CHANNELS,
  SAMPLE_PLACEMENT_METRIC_MODES,
  SAMPLE_PLACEMENT_STATUSES,
  SAMPLE_PLACEMENT_TYPES,
  SAMPLE_PLACEMENT_VOICE_TYPES,
  samplePlacementsToCsv,
  type SamplePlacementChannel,
  type SamplePlacementMetricMode,
  type SamplePlacementStatus,
  type SamplePlacementType,
  type SamplePlacementVoiceType,
} from "@/lib/sample-placements";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await buildSamplePlacementOverview();
    if (new URL(request.url).searchParams.get("format") === "csv") {
      const date = new Date().toISOString().slice(0, 10);
      return new Response(samplePlacementsToCsv(overview.placements), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="nera-placement-impact-${date}.csv"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return placementError(error, "无法读取样衣成果台账，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  let uploadedImageKey = "";
  let placementPersisted = false;
  try {
    const form = await request.formData();
    const title = readText(form, "title", 240);
    if (!title) {
      return Response.json({ error: "请填写成果标题。" }, { status: 400 });
    }

    const loanId = readText(form, "loanId", 120);
    const loan = loanId ? await getSampleLoanWorkspace(loanId) : null;
    if (loanId && !loan) {
      return Response.json({ error: "关联借出单不存在。" }, { status: 404 });
    }

    const loanItemIds = readStringArray(form, "loanItemIds", 100);
    if (!loan && loanItemIds.length > 0) {
      return Response.json(
        { error: "选择 Look 前请先关联借出单。" },
        { status: 400 },
      );
    }
    const availableItems = new Map(
      (loan?.items ?? []).map((item) => [item.id, item]),
    );
    if (loanItemIds.some((id) => !availableItems.has(id))) {
      return Response.json(
        { error: "所选 Look 不属于当前借出单，请刷新后重试。" },
        { status: 409 },
      );
    }

    const status = readEnum(
      form,
      "status",
      SAMPLE_PLACEMENT_STATUSES,
      "pending",
    );
    const placementType = readEnum(
      form,
      "placementType",
      SAMPLE_PLACEMENT_TYPES,
      "editorial",
    );
    const channel = readEnum(
      form,
      "channel",
      SAMPLE_PLACEMENT_CHANNELS,
      "print",
    );
    const voiceType = readEnum(
      form,
      "voiceType",
      SAMPLE_PLACEMENT_VOICE_TYPES,
      "media",
    );
    const metricMode = readEnum(
      form,
      "metricMode",
      SAMPLE_PLACEMENT_METRIC_MODES,
      "not_recorded",
    );
    if (!status || !placementType || !channel || !voiceType || !metricMode) {
      return Response.json(
        { error: "成果状态、类型、渠道或指标口径无效。" },
        { status: 400 },
      );
    }

    const placementDate = normalizeDate(readText(form, "placementDate", 20));
    const rawDate = readText(form, "placementDate", 20);
    if (rawDate && !placementDate) {
      return Response.json({ error: "成果日期无效。" }, { status: 400 });
    }
    const sourceUrl = normalizeUrl(readText(form, "sourceUrl", 1200));
    if (readText(form, "sourceUrl", 1200) && !sourceUrl) {
      return Response.json(
        { error: "证据链接必须是有效的 http 或 https 地址。" },
        { status: 400 },
      );
    }

    const metricSource = readText(form, "metricSource", 500);
    const reportedReach = readNullableInteger(form, "reportedReach");
    const reportedEngagements = readNullableInteger(
      form,
      "reportedEngagements",
    );
    const reportedImpactCents = readNullableMoney(
      form,
      "reportedImpact",
    );
    if (
      reportedReach === undefined ||
      reportedEngagements === undefined ||
      reportedImpactCents === undefined
    ) {
      return Response.json(
        { error: "触达、互动与填报影响值必须为非负数。" },
        { status: 400 },
      );
    }
    const hasReportedMetric =
      reportedReach !== null ||
      reportedEngagements !== null ||
      reportedImpactCents !== null;
    if (hasReportedMetric && metricMode === "not_recorded") {
      return Response.json(
        { error: "填写指标后，请将指标口径设为“填报”或“已核验”。" },
        { status: 400 },
      );
    }
    if (metricMode === "verified" && !metricSource) {
      return Response.json(
        { error: "已核验指标必须注明指标来源。" },
        { status: 400 },
      );
    }
    const rawCurrency = readText(form, "impactCurrency", 3);
    const impactCurrency = normalizeCurrency(rawCurrency) || "USD";
    if (rawCurrency && !normalizeCurrency(rawCurrency)) {
      return Response.json(
        { error: "币种必须为三位字母代码。" },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    let evidenceImageType = "";
    let evidenceImageSize = 0;
    const evidenceFile = form.get("evidenceImage");
    if (evidenceFile instanceof File && evidenceFile.size > 0) {
      const sizeError = imageSizeError(evidenceFile);
      if (sizeError) {
        return Response.json({ error: sizeError }, { status: 400 });
      }
      const bytes = await evidenceFile.arrayBuffer();
      const detected = detectImage(new Uint8Array(bytes));
      if (!detected) {
        return Response.json(
          { error: "证据图片仅支持真实的 JPEG、PNG 或 WebP。" },
          { status: 400 },
        );
      }
      uploadedImageKey = `placements/${now.slice(0, 4)}/${id}.${detected.extension}`;
      evidenceImageType = detected.contentType;
      evidenceImageSize = evidenceFile.size;
      const bucket = await getBucket();
      await bucket.put(uploadedImageKey, bytes, {
        httpMetadata: {
          contentType: detected.contentType,
          cacheControl: "private, no-store",
        },
        customMetadata: {
          placementId: id,
          uploadedBy: auth.user.email,
          originalName: safeOriginalName(evidenceFile.name),
        },
      });
    }

    const placement: NewSamplePlacement = {
      id,
      placementCode: createPlacementCode(now),
      loanId: loan?.loan.id ?? null,
      status: status as SamplePlacementStatus,
      placementType: placementType as SamplePlacementType,
      channel: channel as SamplePlacementChannel,
      title,
      outletName: readText(form, "outletName", 240),
      voiceName: readText(form, "voiceName", 240),
      voiceType: voiceType as SamplePlacementVoiceType,
      eventName: readText(form, "eventName", 240),
      market: readText(form, "market", 120),
      country: readText(form, "country", 120),
      placementDate,
      sourceUrl,
      evidenceImageKey: uploadedImageKey,
      evidenceImageType,
      evidenceImageSize,
      evidenceAltText:
        readText(form, "evidenceAltText", 240) ||
        (uploadedImageKey ? `${title} 成果证据` : ""),
      reportedReach,
      reportedEngagements,
      reportedImpactCents,
      impactCurrency,
      metricMode: metricMode as SamplePlacementMetricMode,
      metricSource,
      notes: readText(form, "notes", 3000),
      createdBy: auth.user.email,
      verifiedBy:
        metricMode === "verified" ? auth.user.email : null,
      verifiedAt: metricMode === "verified" ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    const placementItems: NewSamplePlacementItem[] = loanItemIds.map(
      (loanItemId, index) => {
        const item = availableItems.get(loanItemId);
        if (!item) throw new Error("Selected loan item is unavailable");
        return {
          id: crypto.randomUUID(),
          placementId: id,
          sampleLoanItemId: item.id,
          sampleAssetId: item.sampleAssetId,
          workId: item.workId,
          assetCode: item.sampleCode,
          workTitle: item.workTitle,
          lookNumber: item.lookNumber,
          imageKey: item.imageKey,
          featured: index === 0,
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        };
      },
    );

    const db = await getDb();
    if (placementItems.length > 0) {
      await db.batch([
        db.insert(samplePlacements).values(placement),
        db.insert(samplePlacementItems).values(placementItems),
      ]);
    } else {
      await db.insert(samplePlacements).values(placement);
    }
    placementPersisted = true;

    return Response.json(
      { placement: await getSamplePlacementWorkspace(id) },
      { status: 201 },
    );
  } catch (error) {
    if (uploadedImageKey && !placementPersisted) {
      try {
        const bucket = await getBucket();
        await bucket.delete(uploadedImageKey);
      } catch {
        // The database error remains the actionable failure.
      }
    }
    return placementError(error, "建立样衣成果记录失败，请稍后重试。");
  }
}

function readText(form: FormData, key: string, maxLength: number) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readEnum<const T extends readonly string[]>(
  form: FormData,
  key: string,
  values: T,
  fallback: T[number],
) {
  const value = readText(form, key, 80) || fallback;
  return values.includes(value as T[number]) ? (value as T[number]) : null;
}

function readStringArray(form: FormData, key: string, maxItems: number) {
  const raw = readText(form, key, 20_000);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().slice(0, 120))
          .filter(Boolean),
      ),
    ).slice(0, maxItems);
  } catch {
    return [];
  }
}

function readNullableInteger(form: FormData, key: string) {
  const value = readText(form, key, 40);
  if (!value) return null;
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0 ||
    parsed > 2_147_483_647
  ) {
    return undefined;
  }
  return parsed;
}

function readNullableMoney(form: FormData, key: string) {
  const value = readText(form, key, 60);
  if (!value) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return undefined;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents <= 9_000_000_000_000
    ? cents
    : undefined;
}

function normalizeDate(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

function normalizeUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeCurrency(value: string) {
  const currency = value.toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "";
}

function createPlacementCode(date: string) {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
  return `PLC-${date.slice(2, 10).replaceAll("-", "")}-${suffix}`;
}

function placementError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "样衣成果数据库尚未初始化，请完成新版部署后再试。"
        : message.includes("UNIQUE")
          ? "成果记录发生重复，请刷新后重试。"
          : fallback,
    },
    { status: 500 },
  );
}
