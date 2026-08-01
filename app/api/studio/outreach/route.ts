import { getDb } from "@/db";
import {
  outreachCampaigns,
  type NewOutreachCampaign,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { getCollectionById } from "@/lib/collections";
import {
  cleanOutreachText,
  normalizeOutreachDateTime,
  outreachApiError,
  outreachCode,
} from "@/lib/outreach-input";
import {
  buildOutreachOverview,
  OUTREACH_CAMPAIGN_STATUSES,
  OUTREACH_LANGUAGES,
  OUTREACH_OBJECTIVES,
  outreachCampaignsToCsv,
  outreachRecipientsToCsv,
  type OutreachCampaignStatus,
  type OutreachLanguage,
  type OutreachObjective,
} from "@/lib/outreach";
import { getPublicationById } from "@/lib/publications";
import { getShowroomById } from "@/lib/showrooms";

export const dynamic = "force-dynamic";

type CreatePayload = {
  title?: string;
  objective?: OutreachObjective;
  status?: OutreachCampaignStatus;
  language?: OutreachLanguage;
  collectionId?: string;
  publicationId?: string;
  showroomId?: string;
  market?: string;
  audienceNote?: string;
  subjectLine?: string;
  coreMessage?: string;
  callToAction?: string;
  embargoAt?: string | null;
  windowStartAt?: string | null;
  windowEndAt?: string | null;
  notes?: string;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await buildOutreachOverview();
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "campaigns") {
      return csvResponse(
        outreachCampaignsToCsv(overview),
        `nera-outreach-campaigns-${date}.csv`,
      );
    }
    if (format === "recipients") {
      return csvResponse(
        outreachRecipientsToCsv(overview),
        `nera-outreach-recipients-${date}.csv`,
      );
    }
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-outreach-desk-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return outreachApiError(error, "无法读取外联策划台，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const title = cleanOutreachText(payload.title, 240);
    if (!title) {
      return Response.json({ error: "请填写活动名称。" }, { status: 400 });
    }
    const objective = payload.objective ?? "collection_launch";
    const status = payload.status ?? "draft";
    const language = payload.language ?? "bilingual";
    if (!OUTREACH_OBJECTIVES.includes(objective)) {
      return Response.json({ error: "活动目标无效。" }, { status: 400 });
    }
    if (!OUTREACH_CAMPAIGN_STATUSES.includes(status)) {
      return Response.json({ error: "活动状态无效。" }, { status: 400 });
    }
    if (!OUTREACH_LANGUAGES.includes(language)) {
      return Response.json({ error: "活动语言无效。" }, { status: 400 });
    }
    if (!["draft", "review"].includes(status)) {
      return Response.json(
        { error: "新活动必须先以草稿或审核状态建立。" },
        { status: 400 },
      );
    }
    const resourceResult = await validateResources(payload);
    if (resourceResult.response) return resourceResult.response;
    const dates = validateDates(payload);
    if (dates.response) return dates.response;

    const now = new Date();
    const timestamp = now.toISOString();
    const values: NewOutreachCampaign = {
      id: crypto.randomUUID(),
      campaignCode: outreachCode(now),
      title,
      objective,
      status,
      language,
      collectionId: resourceResult.collectionId,
      publicationId: resourceResult.publicationId,
      showroomId: resourceResult.showroomId,
      market: cleanOutreachText(payload.market, 160),
      audienceNote: cleanOutreachText(payload.audienceNote, 2000),
      subjectLine: cleanOutreachText(payload.subjectLine, 300),
      coreMessage: cleanOutreachText(payload.coreMessage, 5000),
      callToAction: cleanOutreachText(payload.callToAction, 1200),
      embargoAt: dates.embargoAt,
      windowStartAt: dates.windowStartAt,
      windowEndAt: dates.windowEndAt,
      notes: cleanOutreachText(payload.notes, 4000),
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [campaign] = await db
      .insert(outreachCampaigns)
      .values(values)
      .returning();
    return Response.json({ campaign }, { status: 201 });
  } catch (error) {
    return outreachApiError(error, "建立外联活动失败，请稍后重试。");
  }
}

async function validateResources(payload: CreatePayload) {
  const collectionId = cleanOutreachText(payload.collectionId, 160);
  const publicationId = cleanOutreachText(payload.publicationId, 160);
  const showroomId = cleanOutreachText(payload.showroomId, 160);
  const [collection, publication, showroom] = await Promise.all([
    collectionId ? getCollectionById(collectionId) : null,
    publicationId ? getPublicationById(publicationId) : null,
    showroomId ? getShowroomById(showroomId) : null,
  ]);
  if (collectionId && !collection) {
    return {
      response: Response.json({ error: "关联系列不存在。" }, { status: 404 }),
      collectionId: null,
      publicationId: null,
      showroomId: null,
    };
  }
  if (publicationId && !publication) {
    return {
      response: Response.json({ error: "关联发布包不存在。" }, { status: 404 }),
      collectionId: null,
      publicationId: null,
      showroomId: null,
    };
  }
  if (showroomId && !showroom) {
    return {
      response: Response.json({ error: "关联展厅不存在。" }, { status: 404 }),
      collectionId: null,
      publicationId: null,
      showroomId: null,
    };
  }
  return {
    response: null,
    collectionId: collectionId || null,
    publicationId: publicationId || null,
    showroomId: showroomId || null,
  };
}

function validateDates(payload: CreatePayload) {
  const embargoAt = normalizeOutreachDateTime(payload.embargoAt);
  const windowStartAt = normalizeOutreachDateTime(payload.windowStartAt);
  const windowEndAt = normalizeOutreachDateTime(payload.windowEndAt);
  for (const [raw, normalized, label] of [
    [payload.embargoAt, embargoAt, "保密截止时间"],
    [payload.windowStartAt, windowStartAt, "外联开始时间"],
    [payload.windowEndAt, windowEndAt, "外联结束时间"],
  ] as const) {
    if (raw && !normalized) {
      return {
        response: Response.json({ error: `${label}无效。` }, { status: 400 }),
        embargoAt: null,
        windowStartAt: null,
        windowEndAt: null,
      };
    }
  }
  if (
    windowStartAt &&
    windowEndAt &&
    new Date(windowEndAt).getTime() < new Date(windowStartAt).getTime()
  ) {
    return {
      response: Response.json(
        { error: "外联结束时间不能早于开始时间。" },
        { status: 400 },
      ),
      embargoAt: null,
      windowStartAt: null,
      windowEndAt: null,
    };
  }
  if (
    embargoAt &&
    windowStartAt &&
    new Date(embargoAt).getTime() > new Date(windowStartAt).getTime()
  ) {
    return {
      response: Response.json(
        { error: "保密截止时间不能晚于外联开始时间。" },
        { status: 400 },
      ),
      embargoAt: null,
      windowStartAt: null,
      windowEndAt: null,
    };
  }
  return { response: null, embargoAt, windowStartAt, windowEndAt };
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
