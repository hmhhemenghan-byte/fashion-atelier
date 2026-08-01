import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  samplePlacementItems,
  samplePlacements,
  type NewSamplePlacement,
  type NewSamplePlacementItem,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import { getSampleLoanWorkspace } from "@/lib/sample-loans";
import {
  getSamplePlacementWorkspace,
  SAMPLE_PLACEMENT_CHANNELS,
  SAMPLE_PLACEMENT_METRIC_MODES,
  SAMPLE_PLACEMENT_STATUSES,
  SAMPLE_PLACEMENT_TYPES,
  SAMPLE_PLACEMENT_VOICE_TYPES,
  type SamplePlacementChannel,
  type SamplePlacementMetricMode,
  type SamplePlacementStatus,
  type SamplePlacementType,
  type SamplePlacementVoiceType,
} from "@/lib/sample-placements";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type PlacementPatch = {
  status?: SamplePlacementStatus;
  placementType?: SamplePlacementType;
  channel?: SamplePlacementChannel;
  title?: string;
  outletName?: string;
  voiceName?: string;
  voiceType?: SamplePlacementVoiceType;
  eventName?: string;
  market?: string;
  country?: string;
  placementDate?: string | null;
  sourceUrl?: string;
  evidenceAltText?: string;
  reportedReach?: number | null;
  reportedEngagements?: number | null;
  reportedImpact?: number | string | null;
  impactCurrency?: string;
  metricMode?: SamplePlacementMetricMode;
  metricSource?: string;
  notes?: string;
  loanItemIds?: string[];
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getSamplePlacementWorkspace(id);
    if (!current) {
      return Response.json({ error: "成果记录不存在。" }, { status: 404 });
    }

    const payload = (await request.json()) as PlacementPatch;
    const now = new Date().toISOString();
    const update: Partial<NewSamplePlacement> = { updatedAt: now };
    let changed = false;

    if (payload.status !== undefined) {
      if (!SAMPLE_PLACEMENT_STATUSES.includes(payload.status)) {
        return invalid("成果状态无效。");
      }
      update.status = payload.status;
      changed = true;
    }
    if (payload.placementType !== undefined) {
      if (!SAMPLE_PLACEMENT_TYPES.includes(payload.placementType)) {
        return invalid("成果类型无效。");
      }
      update.placementType = payload.placementType;
      changed = true;
    }
    if (payload.channel !== undefined) {
      if (!SAMPLE_PLACEMENT_CHANNELS.includes(payload.channel)) {
        return invalid("成果渠道无效。");
      }
      update.channel = payload.channel;
      changed = true;
    }
    if (payload.voiceType !== undefined) {
      if (!SAMPLE_PLACEMENT_VOICE_TYPES.includes(payload.voiceType)) {
        return invalid("Voice 类型无效。");
      }
      update.voiceType = payload.voiceType;
      changed = true;
    }
    if (payload.metricMode !== undefined) {
      if (!SAMPLE_PLACEMENT_METRIC_MODES.includes(payload.metricMode)) {
        return invalid("指标口径无效。");
      }
      update.metricMode = payload.metricMode;
      changed = true;
    }

    const textFields = [
      ["title", 240],
      ["outletName", 240],
      ["voiceName", 240],
      ["eventName", 240],
      ["market", 120],
      ["country", 120],
      ["evidenceAltText", 240],
      ["metricSource", 500],
      ["notes", 3000],
    ] as const;
    textFields.forEach(([key, max]) => {
      if (payload[key] === undefined) return;
      update[key] = cleanText(payload[key], max);
      changed = true;
    });
    if (payload.title !== undefined && !update.title) {
      return invalid("成果标题不能为空。");
    }

    if (payload.placementDate !== undefined) {
      const date = normalizeDate(payload.placementDate);
      if (payload.placementDate && !date) return invalid("成果日期无效。");
      update.placementDate = date;
      changed = true;
    }
    if (payload.sourceUrl !== undefined) {
      const value = cleanText(payload.sourceUrl, 1200);
      const url = normalizeUrl(value);
      if (value && !url) {
        return invalid("证据链接必须是有效的 http 或 https 地址。");
      }
      update.sourceUrl = url;
      changed = true;
    }
    if (payload.impactCurrency !== undefined) {
      const currency = normalizeCurrency(payload.impactCurrency);
      if (!currency) return invalid("币种必须为三位字母代码。");
      update.impactCurrency = currency;
      changed = true;
    }

    if (payload.reportedReach !== undefined) {
      const value = nullableInteger(payload.reportedReach);
      if (value === undefined) return invalid("填报触达必须为非负整数。");
      update.reportedReach = value;
      changed = true;
    }
    if (payload.reportedEngagements !== undefined) {
      const value = nullableInteger(payload.reportedEngagements);
      if (value === undefined) return invalid("填报互动必须为非负整数。");
      update.reportedEngagements = value;
      changed = true;
    }
    if (payload.reportedImpact !== undefined) {
      const value = nullableMoney(payload.reportedImpact);
      if (value === undefined) return invalid("填报影响值必须为非负数。");
      update.reportedImpactCents = value;
      changed = true;
    }

    const nextMetricMode =
      update.metricMode ?? current.placement.metricMode;
    const nextMetricSource =
      update.metricSource ?? current.placement.metricSource;
    const nextMetrics = [
      update.reportedReach === undefined
        ? current.placement.reportedReach
        : update.reportedReach,
      update.reportedEngagements === undefined
        ? current.placement.reportedEngagements
        : update.reportedEngagements,
      update.reportedImpactCents === undefined
        ? current.placement.reportedImpactCents
        : update.reportedImpactCents,
    ];
    if (
      nextMetricMode === "not_recorded" &&
      nextMetrics.some((value) => value !== null)
    ) {
      return invalid("清空填报指标后，才能将指标口径改为“未记录”。");
    }
    if (nextMetricMode === "verified" && !nextMetricSource) {
      return invalid("已核验指标必须注明指标来源。");
    }
    if (nextMetricMode === "verified") {
      update.verifiedBy = auth.user.email;
      update.verifiedAt = now;
    } else if (
      payload.metricMode !== undefined &&
      payload.metricMode !== "verified"
    ) {
      update.verifiedBy = null;
      update.verifiedAt = null;
    }

    let nextItems: NewSamplePlacementItem[] | null = null;
    if (payload.loanItemIds !== undefined) {
      if (!Array.isArray(payload.loanItemIds)) {
        return invalid("关联 Look 列表无效。");
      }
      const loan = current.placement.loanId
        ? await getSampleLoanWorkspace(current.placement.loanId)
        : null;
      if (!loan && payload.loanItemIds.length > 0) {
        return invalid("当前成果没有可关联的借出单。");
      }
      const uniqueIds = Array.from(
        new Set(
          payload.loanItemIds
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim().slice(0, 120))
            .filter(Boolean),
        ),
      ).slice(0, 100);
      const availableItems = new Map(
        (loan?.items ?? []).map((item) => [item.id, item]),
      );
      if (uniqueIds.some((itemId) => !availableItems.has(itemId))) {
        return Response.json(
          { error: "所选 Look 不属于成果关联的借出单。" },
          { status: 409 },
        );
      }
      nextItems = uniqueIds.map((itemId, index) => {
        const item = availableItems.get(itemId);
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
      });
      changed = true;
    }

    if (!changed) return invalid("没有可保存的修改。");
    const db = await getDb();
    const updatePlacement = db
      .update(samplePlacements)
      .set(update)
      .where(eq(samplePlacements.id, id));
    if (nextItems === null) {
      await updatePlacement;
    } else {
      const clearItems = db
        .delete(samplePlacementItems)
        .where(eq(samplePlacementItems.placementId, id));
      if (nextItems.length > 0) {
        await db.batch([
          updatePlacement,
          clearItems,
          db.insert(samplePlacementItems).values(nextItems),
        ]);
      } else {
        await db.batch([updatePlacement, clearItems]);
      }
    }

    return Response.json({
      placement: await getSamplePlacementWorkspace(id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.includes("no such table")
          ? "样衣成果数据库尚未初始化，请完成新版部署后再试。"
          : "保存成果记录失败，请稍后重试。",
      },
      { status: 500 },
    );
  }
}

function invalid(error: string) {
  return Response.json({ error }, { status: 400 });
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeDate(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
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

function normalizeCurrency(value: unknown) {
  if (typeof value !== "string") return "";
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "";
}

function nullableInteger(value: unknown) {
  if (value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0 ||
    parsed > 2_147_483_647
  ) {
    return undefined;
  }
  return parsed;
}

function nullableMoney(value: unknown) {
  if (value === null || value === "") return null;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return undefined;
  const cents = Math.round(Number(text) * 100);
  return Number.isSafeInteger(cents) && cents <= 9_000_000_000_000
    ? cents
    : undefined;
}
