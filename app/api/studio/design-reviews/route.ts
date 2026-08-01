import { getDb } from "@/db";
import { designReviews, type NewDesignReview } from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  cleanDesignReviewText,
  designReviewApiError,
  designReviewCode,
  normalizeDesignReviewDateTime,
} from "@/lib/design-review-input";
import {
  buildDesignReviewOverview,
  DESIGN_REVIEW_STATUSES,
  DESIGN_REVIEW_TYPES,
  designReviewActionsToCsv,
  designReviewsToCsv,
  type DesignReviewStatus,
  type DesignReviewType,
} from "@/lib/design-reviews";
import { getCollectionById, listCollectionWorks } from "@/lib/collections";
import { getWorkById } from "@/lib/works";

export const dynamic = "force-dynamic";

type CreatePayload = {
  title?: string;
  reviewType?: DesignReviewType;
  status?: DesignReviewStatus;
  collectionId?: string | null;
  workId?: string | null;
  brief?: string;
  reviewerName?: string;
  scheduledAt?: string | null;
};

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const overview = await buildDesignReviewOverview();
    const format = new URL(request.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "reviews") {
      return csvResponse(
        designReviewsToCsv(overview),
        `nera-design-reviews-${date}.csv`,
      );
    }
    if (format === "actions") {
      return csvResponse(
        designReviewActionsToCsv(overview),
        `nera-review-actions-${date}.csv`,
      );
    }
    if (format === "json") {
      return new Response(JSON.stringify(overview, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="nera-atelier-review-board-${date}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }
    return Response.json(
      { overview },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return designReviewApiError(
      error,
      "无法读取设计评审台，请稍后重试。",
    );
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const title = cleanDesignReviewText(payload.title, 240);
    if (!title) {
      return Response.json({ error: "请填写评审主题。" }, { status: 400 });
    }
    const reviewType = payload.reviewType ?? "concept";
    const status = payload.status ?? "planned";
    if (!DESIGN_REVIEW_TYPES.includes(reviewType)) {
      return Response.json({ error: "评审类型无效。" }, { status: 400 });
    }
    if (!DESIGN_REVIEW_STATUSES.includes(status)) {
      return Response.json({ error: "评审状态无效。" }, { status: 400 });
    }
    if (!["planned", "in_review"].includes(status)) {
      return Response.json(
        { error: "新评审必须从计划或评审中开始。" },
        { status: 400 },
      );
    }
    const relation = await validateReviewRelations(
      nullableId(payload.collectionId),
      nullableId(payload.workId),
    );
    if (relation.response) return relation.response;
    const scheduledAt = normalizeDesignReviewDateTime(payload.scheduledAt);
    if (payload.scheduledAt && !scheduledAt) {
      return Response.json({ error: "评审时间无效。" }, { status: 400 });
    }
    const now = new Date();
    const timestamp = now.toISOString();
    const values: NewDesignReview = {
      id: crypto.randomUUID(),
      reviewCode: designReviewCode(now),
      title,
      reviewType,
      status,
      decision: "pending",
      collectionId: relation.collectionId,
      workId: relation.workId,
      brief: cleanDesignReviewText(payload.brief, 4000),
      observations: "",
      conclusion: "",
      reviewerName: cleanDesignReviewText(payload.reviewerName, 180),
      scheduledAt,
      decidedAt: null,
      createdBy: auth.user.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const db = await getDb();
    const [review] = await db
      .insert(designReviews)
      .values(values)
      .returning();
    return Response.json({ review }, { status: 201 });
  } catch (error) {
    return designReviewApiError(error, "建立设计评审失败，请稍后重试。");
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

function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
