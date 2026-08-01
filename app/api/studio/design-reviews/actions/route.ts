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
  getDesignReview,
  type DesignReviewActionPriority,
} from "@/lib/design-reviews";

export const dynamic = "force-dynamic";

type CreatePayload = {
  reviewId?: string;
  title?: string;
  priority?: DesignReviewActionPriority;
  ownerName?: string;
  dueAt?: string | null;
  notes?: string;
};

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const reviewId = cleanDesignReviewText(payload.reviewId, 160);
    const title = cleanDesignReviewText(payload.title, 360);
    if (!reviewId || !title) {
      return Response.json(
        { error: "评审与修改任务名称为必填项。" },
        { status: 400 },
      );
    }
    const review = await getDesignReview(reviewId);
    if (!review) {
      return Response.json({ error: "设计评审不存在。" }, { status: 404 });
    }
    if (["closed", "cancelled"].includes(review.status)) {
      return Response.json(
        { error: "已关闭或取消的评审不能新增修改任务。" },
        { status: 400 },
      );
    }
    const priority = payload.priority ?? "normal";
    if (!DESIGN_REVIEW_ACTION_PRIORITIES.includes(priority)) {
      return Response.json({ error: "修改优先级无效。" }, { status: 400 });
    }
    const dueAt = normalizeDesignReviewDateTime(payload.dueAt);
    if (payload.dueAt && !dueAt) {
      return Response.json({ error: "任务截止时间无效。" }, { status: 400 });
    }
    const timestamp = new Date().toISOString();
    const values: NewDesignReviewAction = {
      id: crypto.randomUUID(),
      reviewId,
      title,
      priority,
      status: "open",
      ownerName: cleanDesignReviewText(payload.ownerName, 180),
      dueAt,
      notes: cleanDesignReviewText(payload.notes, 4000),
      resolvedAt: null,
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [action] = await db
      .insert(designReviewActions)
      .values(values)
      .returning();
    return Response.json({ action }, { status: 201 });
  } catch (error) {
    return designReviewApiError(error, "建立修改任务失败，请稍后重试。");
  }
}
