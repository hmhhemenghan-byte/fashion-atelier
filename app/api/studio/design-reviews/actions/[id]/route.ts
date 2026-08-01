import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  designReviewActions,
  type NewDesignReviewAction,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanDesignReviewText,
  designReviewApiError,
  normalizeDesignReviewDateTime,
} from "@/lib/design-review-input";
import {
  DESIGN_REVIEW_ACTION_PRIORITIES,
  DESIGN_REVIEW_ACTION_STATUSES,
  getDesignReview,
  getDesignReviewAction,
  type DesignReviewActionPriority,
  type DesignReviewActionStatus,
} from "@/lib/design-reviews";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type UpdatePayload = {
  title?: string;
  priority?: DesignReviewActionPriority;
  status?: DesignReviewActionStatus;
  ownerName?: string;
  dueAt?: string | null;
  notes?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const current = await getDesignReviewAction(id);
    if (!current) {
      return Response.json({ error: "修改任务不存在。" }, { status: 404 });
    }
    const review = await getDesignReview(current.reviewId);
    if (!review) {
      return Response.json({ error: "所属设计评审不存在。" }, { status: 404 });
    }
    if (["closed", "cancelled"].includes(review.status)) {
      return Response.json(
        { error: "已关闭或取消的评审不能再修改任务状态。" },
        { status: 400 },
      );
    }
    const payload = (await request.json()) as UpdatePayload;
    const timestamp = new Date().toISOString();
    const update: Partial<NewDesignReviewAction> = {
      updatedAt: timestamp,
    };
    let changed = false;

    if (payload.title !== undefined) {
      const value = cleanDesignReviewText(payload.title, 360);
      if (!value) {
        return Response.json(
          { error: "修改任务名称不能为空。" },
          { status: 400 },
        );
      }
      update.title = value;
      changed = true;
    }
    if (payload.priority !== undefined) {
      if (!DESIGN_REVIEW_ACTION_PRIORITIES.includes(payload.priority)) {
        return Response.json({ error: "修改优先级无效。" }, { status: 400 });
      }
      update.priority = payload.priority;
      changed = true;
    }
    if (payload.status !== undefined) {
      if (!DESIGN_REVIEW_ACTION_STATUSES.includes(payload.status)) {
        return Response.json({ error: "修改任务状态无效。" }, { status: 400 });
      }
      update.status = payload.status;
      update.resolvedAt =
        payload.status === "done" ? timestamp : null;
      changed = true;
    }
    for (const [key, maxLength] of [
      ["ownerName", 180],
      ["notes", 4000],
    ] as const) {
      if (payload[key] !== undefined) {
        update[key] = cleanDesignReviewText(payload[key], maxLength);
        changed = true;
      }
    }
    if (payload.dueAt !== undefined) {
      const value = normalizeDesignReviewDateTime(payload.dueAt);
      if (payload.dueAt && !value) {
        return Response.json({ error: "任务截止时间无效。" }, { status: 400 });
      }
      update.dueAt = value;
      changed = true;
    }
    if (!changed) {
      return Response.json({ error: "没有可保存的修改。" }, { status: 400 });
    }

    const db = await getDb();
    const [action] = await db
      .update(designReviewActions)
      .set(update)
      .where(eq(designReviewActions.id, id))
      .returning();
    return Response.json({ action });
  } catch (error) {
    return designReviewApiError(error, "更新修改任务失败，请稍后重试。");
  }
}
