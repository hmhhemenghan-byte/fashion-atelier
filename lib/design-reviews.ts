import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  designReviewActions,
  designReviews,
  type DesignReview,
  type DesignReviewAction,
} from "@/db/schema";
import {
  listAllCollectionAssignments,
  listAllCollections,
} from "@/lib/collections";
import { listAllWorks } from "@/lib/works";

export const DESIGN_REVIEW_TYPES = [
  "concept",
  "silhouette",
  "material",
  "fitting",
  "construction",
  "styling",
  "final_edit",
  "other",
] as const;

export const DESIGN_REVIEW_STATUSES = [
  "planned",
  "in_review",
  "decided",
  "closed",
  "cancelled",
] as const;

export const DESIGN_REVIEW_DECISIONS = [
  "pending",
  "approved",
  "revise",
  "hold",
  "drop",
] as const;

export const DESIGN_REVIEW_ACTION_PRIORITIES = [
  "low",
  "normal",
  "high",
  "critical",
] as const;

export const DESIGN_REVIEW_ACTION_STATUSES = [
  "open",
  "in_progress",
  "done",
  "cancelled",
] as const;

export type DesignReviewType = (typeof DESIGN_REVIEW_TYPES)[number];
export type DesignReviewStatus =
  (typeof DESIGN_REVIEW_STATUSES)[number];
export type DesignReviewDecision =
  (typeof DESIGN_REVIEW_DECISIONS)[number];
export type DesignReviewActionPriority =
  (typeof DESIGN_REVIEW_ACTION_PRIORITIES)[number];
export type DesignReviewActionStatus =
  (typeof DESIGN_REVIEW_ACTION_STATUSES)[number];

export type DesignReviewReference = {
  collection: {
    id: string;
    title: string;
    season: string;
    year: number;
    status: string;
  } | null;
  work: {
    id: string;
    title: string;
    lookNumber: string;
    status: string;
  } | null;
};

export type DesignReviewWorkspace = DesignReviewReference & {
  review: DesignReview;
  actions: DesignReviewAction[];
  summary: {
    totalActions: number;
    openActions: number;
    overdueActions: number;
    criticalActions: number;
    completion: number;
  };
};

export type DesignReviewAgendaItem = {
  id: string;
  reviewId: string;
  kind: "review" | "action";
  title: string;
  context: string;
  dueAt: string | null;
  urgency: "overdue" | "today" | "upcoming" | "open";
  priority: DesignReviewActionPriority | null;
};

export type DesignReviewOverview = {
  generatedAt: string;
  metrics: {
    reviewCount: number;
    activeReviewCount: number;
    decidedCount: number;
    reviseCount: number;
    openActionCount: number;
    overdueActionCount: number;
    criticalActionCount: number;
    closureRate: number;
  };
  breakdown: Array<{
    decision: DesignReviewDecision;
    count: number;
  }>;
  agenda: DesignReviewAgendaItem[];
  reviews: DesignReviewWorkspace[];
  references: {
    collections: Array<{
      id: string;
      title: string;
      season: string;
      year: number;
      status: string;
    }>;
    works: Array<{
      id: string;
      title: string;
      lookNumber: string;
      collection: string;
      status: string;
      collectionIds: string[];
    }>;
  };
};

const CLOSED_REVIEW_STATUSES = new Set(["closed", "cancelled"]);
const CLOSED_ACTION_STATUSES = new Set(["done", "cancelled"]);
const DAY_MS = 24 * 60 * 60 * 1000;

export async function listAllDesignReviews(limit = 2000) {
  const db = await getDb();
  return db
    .select()
    .from(designReviews)
    .orderBy(
      asc(designReviews.status),
      asc(designReviews.scheduledAt),
      desc(designReviews.updatedAt),
    )
    .limit(limit);
}

export async function listAllDesignReviewActions(limit = 8000) {
  const db = await getDb();
  return db
    .select()
    .from(designReviewActions)
    .orderBy(
      asc(designReviewActions.status),
      asc(designReviewActions.dueAt),
      desc(designReviewActions.updatedAt),
    )
    .limit(limit);
}

export async function getDesignReview(id: string) {
  const db = await getDb();
  const [review] = await db
    .select()
    .from(designReviews)
    .where(eq(designReviews.id, id))
    .limit(1);
  return review ?? null;
}

export async function getDesignReviewAction(id: string) {
  const db = await getDb();
  const [action] = await db
    .select()
    .from(designReviewActions)
    .where(eq(designReviewActions.id, id))
    .limit(1);
  return action ?? null;
}

export async function listDesignReviewActions(reviewId: string) {
  const db = await getDb();
  return db
    .select()
    .from(designReviewActions)
    .where(eq(designReviewActions.reviewId, reviewId))
    .orderBy(
      asc(designReviewActions.status),
      asc(designReviewActions.dueAt),
      desc(designReviewActions.createdAt),
    );
}

export async function buildDesignReviewOverview(
  now = new Date(),
): Promise<DesignReviewOverview> {
  const [reviews, actions, collections, works, assignments] = await Promise.all([
    listAllDesignReviews(),
    listAllDesignReviewActions(),
    listAllCollections(1000),
    listAllWorks(2000),
    listAllCollectionAssignments(),
  ]);
  const collectionById = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const workById = new Map(works.map((work) => [work.id, work]));
  const actionsByReview = groupBy(actions, (action) => action.reviewId);
  const assignmentsByWork = groupBy(
    assignments,
    (assignment) => assignment.workId,
  );
  const nowMs = now.getTime();

  const workspaces = reviews.map((review) => {
    const reviewActions = actionsByReview.get(review.id) ?? [];
    const openActions = reviewActions.filter(
      (action) => !CLOSED_ACTION_STATUSES.has(action.status),
    );
    const overdueActions = openActions.filter(
      (action) =>
        action.dueAt && timestamp(action.dueAt) < nowMs,
    );
    const doneCount = reviewActions.filter(
      (action) => action.status === "done",
    ).length;
    return {
      review,
      collection: review.collectionId
        ? toCollectionReference(collectionById.get(review.collectionId))
        : null,
      work: review.workId
        ? toWorkReference(workById.get(review.workId))
        : null,
      actions: reviewActions,
      summary: {
        totalActions: reviewActions.length,
        openActions: openActions.length,
        overdueActions: overdueActions.length,
        criticalActions: openActions.filter(
          (action) => action.priority === "critical",
        ).length,
        completion:
          reviewActions.length > 0
            ? Math.round((doneCount / reviewActions.length) * 100)
            : 100,
      },
    } satisfies DesignReviewWorkspace;
  });

  const activeReviews = reviews.filter(
    (review) => !CLOSED_REVIEW_STATUSES.has(review.status),
  );
  const openActions = actions.filter(
    (action) => !CLOSED_ACTION_STATUSES.has(action.status),
  );
  const overdueActions = openActions.filter(
    (action) => action.dueAt && timestamp(action.dueAt) < nowMs,
  );
  const closedReviews = reviews.filter(
    (review) => review.status === "closed",
  ).length;

  return {
    generatedAt: now.toISOString(),
    metrics: {
      reviewCount: reviews.length,
      activeReviewCount: activeReviews.length,
      decidedCount: reviews.filter(
        (review) =>
          review.decision !== "pending" &&
          review.status !== "cancelled",
      ).length,
      reviseCount: reviews.filter(
        (review) =>
          review.decision === "revise" &&
          review.status !== "closed",
      ).length,
      openActionCount: openActions.length,
      overdueActionCount: overdueActions.length,
      criticalActionCount: openActions.filter(
        (action) => action.priority === "critical",
      ).length,
      closureRate:
        reviews.length > 0
          ? Math.round((closedReviews / reviews.length) * 100)
          : 0,
    },
    breakdown: DESIGN_REVIEW_DECISIONS.map((decision) => ({
      decision,
      count: reviews.filter((review) => review.decision === decision).length,
    })),
    agenda: buildReviewAgenda(workspaces, now),
    reviews: workspaces,
    references: {
      collections: collections.map((collection) => ({
        id: collection.id,
        title: collection.title,
        season: collection.season,
        year: collection.year,
        status: collection.status,
      })),
      works: works.map((work) => ({
        id: work.id,
        title: work.title,
        lookNumber: work.lookNumber,
        collection: work.collection,
        status: work.status,
        collectionIds: (assignmentsByWork.get(work.id) ?? [])
          .map((assignment) => assignment.collectionId),
      })),
    },
  };
}

export function designReviewsToCsv(overview: DesignReviewOverview): string {
  const columns = [
    "reviewCode",
    "title",
    "reviewType",
    "status",
    "decision",
    "collection",
    "work",
    "reviewer",
    "scheduledAt",
    "decidedAt",
    "brief",
    "observations",
    "conclusion",
    "openActions",
    "overdueActions",
    "createdAt",
    "updatedAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.reviews.forEach((workspace) => {
    const review = workspace.review;
    lines.push(
      [
        review.reviewCode,
        review.title,
        review.reviewType,
        review.status,
        review.decision,
        workspace.collection?.title ?? "",
        workspace.work?.title ?? "",
        review.reviewerName,
        review.scheduledAt,
        review.decidedAt,
        review.brief,
        review.observations,
        review.conclusion,
        workspace.summary.openActions,
        workspace.summary.overdueActions,
        review.createdAt,
        review.updatedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function designReviewActionsToCsv(
  overview: DesignReviewOverview,
): string {
  const columns = [
    "reviewCode",
    "reviewTitle",
    "action",
    "priority",
    "status",
    "owner",
    "dueAt",
    "notes",
    "resolvedAt",
    "createdAt",
    "updatedAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.reviews.forEach((workspace) => {
    workspace.actions.forEach((action) => {
      lines.push(
        [
          workspace.review.reviewCode,
          workspace.review.title,
          action.title,
          action.priority,
          action.status,
          action.ownerName,
          action.dueAt,
          action.notes,
          action.resolvedAt,
          action.createdAt,
          action.updatedAt,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });
  return `\ufeff${lines.join("\r\n")}`;
}

function buildReviewAgenda(
  workspaces: DesignReviewWorkspace[],
  now: Date,
): DesignReviewAgendaItem[] {
  const nowMs = now.getTime();
  const fourteenDaysAt = nowMs + 14 * DAY_MS;
  const items: DesignReviewAgendaItem[] = [];

  workspaces.forEach((workspace) => {
    const review = workspace.review;
    const context =
      workspace.work?.title ??
      workspace.collection?.title ??
      "ATELIER / 全局评审";
    if (
      !CLOSED_REVIEW_STATUSES.has(review.status) &&
      review.scheduledAt &&
      timestamp(review.scheduledAt) <= fourteenDaysAt
    ) {
      items.push({
        id: `review-${review.id}`,
        reviewId: review.id,
        kind: "review",
        title: review.title,
        context,
        dueAt: review.scheduledAt,
        urgency: urgencyFor(review.scheduledAt, now),
        priority: null,
      });
    }
    workspace.actions
      .filter(
        (action) =>
          !CLOSED_ACTION_STATUSES.has(action.status) &&
          (!action.dueAt ||
            timestamp(action.dueAt) <= fourteenDaysAt),
      )
      .forEach((action) => {
        items.push({
          id: `action-${action.id}`,
          reviewId: review.id,
          kind: "action",
          title: action.title,
          context: `${review.reviewCode} · ${context}`,
          dueAt: action.dueAt,
          urgency: action.dueAt
            ? urgencyFor(action.dueAt, now)
            : "open",
          priority: action.priority,
        });
      });
  });

  return items
    .sort((left, right) => {
      const urgency =
        urgencyRank(left.urgency) - urgencyRank(right.urgency);
      if (urgency !== 0) return urgency;
      const priority =
        priorityRank(right.priority) - priorityRank(left.priority);
      if (priority !== 0) return priority;
      return timestamp(left.dueAt) - timestamp(right.dueAt);
    })
    .slice(0, 24);
}

function toCollectionReference(
  collection:
    | Awaited<ReturnType<typeof listAllCollections>>[number]
    | undefined,
): DesignReviewReference["collection"] {
  return collection
    ? {
        id: collection.id,
        title: collection.title,
        season: collection.season,
        year: collection.year,
        status: collection.status,
      }
    : null;
}

function toWorkReference(
  work: Awaited<ReturnType<typeof listAllWorks>>[number] | undefined,
): DesignReviewReference["work"] {
  return work
    ? {
        id: work.id,
        title: work.title,
        lookNumber: work.lookNumber,
        status: work.status,
      }
    : null;
}

function groupBy<T>(
  rows: T[],
  keyFor: (row: T) => string,
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  rows.forEach((row) => {
    const key = keyFor(row);
    const current = result.get(key) ?? [];
    current.push(row);
    result.set(key, current);
  });
  return result;
}

function timestamp(value: string | null): number {
  if (!value) return Infinity;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Infinity;
}

function urgencyFor(
  value: string,
  now: Date,
): DesignReviewAgendaItem["urgency"] {
  const parsed = timestamp(value);
  if (parsed < now.getTime()) return "overdue";
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  return parsed < tomorrow.getTime() ? "today" : "upcoming";
}

function urgencyRank(value: DesignReviewAgendaItem["urgency"]): number {
  return value === "overdue"
    ? 0
    : value === "today"
      ? 1
      : value === "open"
        ? 2
        : 3;
}

function priorityRank(
  value: DesignReviewActionPriority | null,
): number {
  return value === "critical"
    ? 4
    : value === "high"
      ? 3
      : value === "normal"
        ? 2
        : value === "low"
          ? 1
          : 0;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
