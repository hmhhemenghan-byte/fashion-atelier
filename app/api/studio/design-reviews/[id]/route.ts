import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { designReviews, type NewDesignReview } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanDesignReviewText,
  designReviewApiError,
  normalizeDesignReviewDateTime,
} from "@/lib/design-review-input";
import {
  DESIGN_REVIEW_DECISIONS,
  DESIGN_REVIEW_STATUSES,
  DESIGN_REVIEW_TYPES,
  getDesignReview,
  listDesignReviewActions,
  type DesignReviewDecision,
  type DesignReviewStatus,
  type DesignReviewType,
} from "@/lib/design-reviews";
import { getCollectionById, listCollectionWorks } from "@/lib/collections";
import { getWorkById } from "@/lib/works";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  title?: string;
  reviewType?: DesignReviewType;
  status?: DesignReviewStatus;
  decision?: DesignReviewDecision;
  collectionId?: string | null;
  workId?: string | null;
  brief?: string;
  observations?: string;
  conclusion?: string;
  reviewerName?: string;
  scheduledAt?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getDesignReview(id);
    if (!current) {
      return Response.json({ error: "设计评审不存在。" }, { status: 404 });
    }
    const payload = (await request.json()) as UpdatePayload;
    const timestamp = new Date().toISOString();
    const update: Partial<NewDesignReview> = { updatedAt: timestamp };
    let changed = false;

    if (payload.title !== undefined) {
      const value = cleanDesignReviewText(payload.title, 240);
      if (!value) {
        return Response.json(
          { error: "评审主题不能为空。" },
          { status: 400 },
        );
      }
      update.title = value;
      changed = true;
    }
    if (payload.reviewType !== undefined) {
      if (!DESIGN_REVIEW_TYPES.includes(payload.reviewType)) {
        return Response.json({ error: "评审类型无效。" }, { status: 400 });
      }
      update.reviewType = payload.reviewType;
      changed = true;
    }
    for (const [key, maxLength] of [
      ["brief", 4000],
      ["observations", 8000],
      ["conclusion", 5000],
      ["reviewerName", 180],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanDesignReviewText(payload[key], maxLength);
        changed = true;
      }
    }
    if (payload.scheduledAt !== undefined) {
      const value = normalizeDesignReviewDateTime(payload.scheduledAt);
      if (payload.scheduledAt && !value) {
        return Response.json({ error: "评审时间无效。" }, { status: 400 });
      }
      update.scheduledAt = value;
      changed = true;
    }
    if (
      payload.collectionId !== undefined ||
      payload.workId !== undefined
    ) {
      const collectionId =
        payload.collectionId !== undefined
          ? nullableId(payload.collectionId)
          : current.collectionId;
      const workId =
        payload.workId !== undefined
          ? nullableId(payload.workId)
          : current.workId;
      const relation = await validateReviewRelations(collectionId, workId);
      if (relation.response) return relation.response;
      update.collectionId = relation.collectionId;
      update.workId = relation.workId;
      changed = true;
    }
    if (payload.decision !== undefined) {
      if (!DESIGN_REVIEW_DECISIONS.includes(payload.decision)) {
        return Response.json({ error: "评审结论无效。" }, { status: 400 });
      }
      update.decision = payload.decision;
      update.decidedAt =
        payload.decision === "pending" ? null : timestamp;
      if (payload.status === undefined) {
        update.status =
          payload.decision === "pending" ? "in_review" : "decided";
      }
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!DESIGN_REVIEW_STATUSES.includes(payload.status)) {
        return Response.json({ error: "评审状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const nextDecision = update.decision ?? current.decision;
    const nextStatus = update.status ?? current.status;
    const nextConclusion = update.conclusion ?? current.conclusion;
    if (
      ["planned", "in_review"].includes(nextStatus) &&
      nextDecision !== "pending"
    ) {
      return Response.json(
        { error: "已经形成结论的评审应进入“已形成结论”或“已闭环”状态。" },
        { status: 400 },
      );
    }
    if (nextStatus === "decided" && nextDecision === "pending") {
      return Response.json(
        { error: "尚未形成设计结论，不能标记为“已形成结论”。" },
        { status: 400 },
      );
    }
    if (nextDecision !== "pending" && !nextConclusion.trim()) {
      return Response.json(
        { error: "形成结论前请填写评审结论与判断依据。" },
        { status: 400 },
      );
    }
    if (nextStatus === "closed") {
      if (nextDecision === "pending") {
        return Response.json(
          { error: "尚未形成评审结论，不能关闭评审。" },
          { status: 400 },
        );
      }
      const actions = await listDesignReviewActions(id);
      const openCount = actions.filter(
        (action) => !["done", "cancelled"].includes(action.status),
      ).length;
      if (openCount > 0) {
        return Response.json(
          { error: `仍有 ${openCount} 项修改任务未完成，不能关闭评审。` },
          { status: 400 },
        );
      }
    }

    const db = await getDb();
    const [review] = await db
      .update(designReviews)
      .set(update)
      .where(eq(designReviews.id, id))
      .returning();
    return Response.json({ review });
  } catch (error) {
    return designReviewApiError(error, "更新设计评审失败，请稍后重试。");
  }
}

async function validateReviewRelations(
  collectionId: string | null,
  workId: string | null,
) {
  const [collection, work] = await Promise.all([
    collectionId ? getCollectionById(collectionId) : null,
    workId ? getWorkById(workId) : null,
  ]);
  if (collectionId && !collection) {
    return {
      response: Response.json({ error: "关联系列不存在。" }, { status: 404 }),
      collectionId: null,
      workId: null,
    };
  }
  if (workId && !work) {
    return {
      response: Response.json({ error: "关联作品不存在。" }, { status: 404 }),
      collectionId: null,
      workId: null,
    };
  }
  if (collection && work) {
    const lineup = await listCollectionWorks(collection.id, true);
    if (!lineup.some((item) => item.work.id === work.id)) {
      return {
        response: Response.json(
          { error: "所选作品尚未编入该系列。" },
          { status: 400 },
        ),
        collectionId: null,
        workId: null,
      };
    }
  }
  return {
    response: null,
    collectionId: collection?.id ?? null,
    workId: work?.id ?? null,
  };
}

function nullableId(value: unknown): string | null {
  return cleanDesignReviewText(value, 160) || null;
}
