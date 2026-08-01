import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  outreachCampaigns,
  type NewOutreachCampaign,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanOutreachText,
  normalizeOutreachDateTime,
  outreachApiError,
} from "@/lib/outreach-input";
import {
  buildOutreachOverview,
  getOutreachCampaign,
  OUTREACH_CAMPAIGN_STATUSES,
  OUTREACH_LANGUAGES,
  OUTREACH_OBJECTIVES,
  type OutreachCampaignStatus,
  type OutreachLanguage,
  type OutreachObjective,
} from "@/lib/outreach";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  title?: string;
  objective?: OutreachObjective;
  status?: OutreachCampaignStatus;
  language?: OutreachLanguage;
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

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getOutreachCampaign(id);
    if (!current) {
      return Response.json({ error: "外联活动不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;
    if (
      payload.status &&
      ["ready", "active"].includes(payload.status) &&
      payload.status !== current.status
    ) {
      const overview = await buildOutreachOverview();
      const workspace = overview.campaigns.find(
        (item) => item.campaign.id === id,
      );
      if (!workspace || workspace.blockers.length > 0) {
        return Response.json(
          {
            error: `活动尚未准备完成：${
              workspace?.blockers.slice(0, 3).join("；") || "资料不完整"
            }。请先保存资料并完成对象审核。`,
          },
          { status: 409 },
        );
      }
    }

    const update: Partial<NewOutreachCampaign> = {
      updatedAt: new Date().toISOString(),
    };
    let changed = false;
    if (payload.title !== undefined) {
      const value = cleanOutreachText(payload.title, 240);
      if (!value) {
        return Response.json(
          { error: "活动名称不能为空。" },
          { status: 400 },
        );
      }
      update.title = value;
      changed = true;
    }
    if (payload.objective !== undefined) {
      if (!OUTREACH_OBJECTIVES.includes(payload.objective)) {
        return Response.json({ error: "活动目标无效。" }, { status: 400 });
      }
      update.objective = payload.objective;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!OUTREACH_CAMPAIGN_STATUSES.includes(payload.status)) {
        return Response.json({ error: "活动状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      changed = true;
    }
    if (payload.language !== undefined) {
      if (!OUTREACH_LANGUAGES.includes(payload.language)) {
        return Response.json({ error: "活动语言无效。" }, { status: 400 });
      }
      update.language = payload.language;
      changed = true;
    }
    for (const [key, maxLength] of [
      ["market", 160],
      ["audienceNote", 2000],
      ["subjectLine", 300],
      ["coreMessage", 5000],
      ["callToAction", 1200],
      ["notes", 4000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanOutreachText(payload[key], maxLength);
        changed = true;
      }
    }
    const dateValues = [
      ["embargoAt", payload.embargoAt],
      ["windowStartAt", payload.windowStartAt],
      ["windowEndAt", payload.windowEndAt],
    ] as const;
    for (const [key, raw] of dateValues) {
      if (raw !== undefined) {
        const value = normalizeOutreachDateTime(raw);
        if (raw && !value) {
          return Response.json({ error: "时间格式无效。" }, { status: 400 });
        }
        update[key] = value;
        changed = true;
      }
    }
    const nextStart =
      payload.windowStartAt !== undefined
        ? update.windowStartAt ?? null
        : current.windowStartAt;
    const nextEnd =
      payload.windowEndAt !== undefined
        ? update.windowEndAt ?? null
        : current.windowEndAt;
    const nextEmbargo =
      payload.embargoAt !== undefined
        ? update.embargoAt ?? null
        : current.embargoAt;
    if (
      nextStart &&
      nextEnd &&
      new Date(nextEnd).getTime() < new Date(nextStart).getTime()
    ) {
      return Response.json(
        { error: "外联结束时间不能早于开始时间。" },
        { status: 400 },
      );
    }
    if (
      nextEmbargo &&
      nextStart &&
      new Date(nextEmbargo).getTime() > new Date(nextStart).getTime()
    ) {
      return Response.json(
        { error: "保密截止时间不能晚于外联开始时间。" },
        { status: 400 },
      );
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const db = await getDb();
    const [campaign] = await db
      .update(outreachCampaigns)
      .set(update)
      .where(eq(outreachCampaigns.id, id))
      .returning();
    return Response.json({ campaign });
  } catch (error) {
    return outreachApiError(error, "更新外联活动失败，请稍后重试。");
  }
}
