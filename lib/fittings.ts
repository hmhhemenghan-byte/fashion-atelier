import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  fittingImages,
  fittingIssues,
  fittingSessions,
  type FittingImage,
  type FittingIssue,
  type FittingSession,
} from "@/db/schema";
import {
  listAllTechnicalPacks,
} from "@/lib/technical-packs";
import { listAllWorks, mediaUrl } from "@/lib/works";

export const FITTING_STATUSES = [
  "planned",
  "in_review",
  "approved",
  "closed",
  "cancelled",
] as const;

export const FITTING_DECISIONS = [
  "pending",
  "approve",
  "revise",
  "hold",
] as const;

export const FITTING_ISSUE_CATEGORIES = [
  "balance",
  "proportion",
  "ease",
  "length",
  "shape",
  "mobility",
  "construction",
  "styling",
  "other",
] as const;

export const FITTING_SIDES = [
  "all",
  "front",
  "back",
  "left",
  "right",
  "inside",
] as const;

export const FITTING_ISSUE_SEVERITIES = [
  "note",
  "important",
  "critical",
] as const;

export const FITTING_ISSUE_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "removed",
] as const;

export const FITTING_IMAGE_ANGLES = [
  "front",
  "side",
  "back",
  "detail",
  "movement",
  "other",
] as const;

export const FITTING_IMAGE_STATUSES = ["active", "removed"] as const;

export type FittingStatus = (typeof FITTING_STATUSES)[number];
export type FittingDecision = (typeof FITTING_DECISIONS)[number];
export type FittingIssueCategory =
  (typeof FITTING_ISSUE_CATEGORIES)[number];
export type FittingSide = (typeof FITTING_SIDES)[number];
export type FittingIssueSeverity =
  (typeof FITTING_ISSUE_SEVERITIES)[number];
export type FittingIssueStatus =
  (typeof FITTING_ISSUE_STATUSES)[number];
export type FittingImageAngle =
  (typeof FITTING_IMAGE_ANGLES)[number];
export type FittingImageStatus =
  (typeof FITTING_IMAGE_STATUSES)[number];

export type FittingWorkspace = {
  session: FittingSession;
  technicalPack: {
    id: string;
    techPackCode: string;
    revision: number;
    status: string;
    sampleStage: string;
    baseSize: string;
    unit: string;
    fitIntent: string;
  } | null;
  work: {
    id: string;
    title: string;
    lookNumber: string;
    collection: string;
    status: string;
    imageUrl: string;
  } | null;
  issues: FittingIssue[];
  images: Array<FittingImage & { imageUrl: string }>;
  summary: {
    activeImages: number;
    openIssues: number;
    criticalOpenIssues: number;
    resolvedIssues: number;
    completeness: number;
    missingFields: string[];
    approvalReady: boolean;
  };
};

export type FittingOverview = {
  generatedAt: string;
  metrics: {
    sessionCount: number;
    plannedCount: number;
    reviewCount: number;
    approvedCount: number;
    incompleteCount: number;
    criticalOpenCount: number;
    packsWithoutFittingCount: number;
  };
  sessions: FittingWorkspace[];
  references: {
    technicalPacks: Array<{
      id: string;
      techPackCode: string;
      revision: number;
      status: string;
      sampleStage: string;
      baseSize: string;
      unit: string;
      workId: string;
      workTitle: string;
      lookNumber: string;
      collection: string;
      workImageUrl: string;
      latestFittingRound: number;
      hasApprovedFitting: boolean;
    }>;
  };
};

export async function listAllFittingSessions(limit = 4000) {
  const db = await getDb();
  return db
    .select()
    .from(fittingSessions)
    .orderBy(
      desc(fittingSessions.updatedAt),
      desc(fittingSessions.round),
    )
    .limit(limit);
}

export async function listAllFittingIssues(limit = 20000) {
  const db = await getDb();
  return db
    .select()
    .from(fittingIssues)
    .orderBy(
      asc(fittingIssues.fittingSessionId),
      asc(fittingIssues.sortOrder),
      desc(fittingIssues.updatedAt),
    )
    .limit(limit);
}

export async function listAllFittingImages(limit = 20000) {
  const db = await getDb();
  return db
    .select()
    .from(fittingImages)
    .orderBy(
      asc(fittingImages.fittingSessionId),
      asc(fittingImages.sortOrder),
      asc(fittingImages.createdAt),
    )
    .limit(limit);
}

export async function getFittingSession(id: string) {
  const db = await getDb();
  const [session] = await db
    .select()
    .from(fittingSessions)
    .where(eq(fittingSessions.id, id))
    .limit(1);
  return session ?? null;
}

export async function getFittingIssue(id: string) {
  const db = await getDb();
  const [issue] = await db
    .select()
    .from(fittingIssues)
    .where(eq(fittingIssues.id, id))
    .limit(1);
  return issue ?? null;
}

export async function getFittingImage(id: string) {
  const db = await getDb();
  const [image] = await db
    .select()
    .from(fittingImages)
    .where(eq(fittingImages.id, id))
    .limit(1);
  return image ?? null;
}

export async function buildFittingOverview(): Promise<FittingOverview> {
  const [sessionRows, issueRows, imageRows, packRows, works] =
    await Promise.all([
      listAllFittingSessions(),
      listAllFittingIssues(),
      listAllFittingImages(),
      listAllTechnicalPacks(),
      listAllWorks(3000),
    ]);
  const issueBySession = groupBy(
    issueRows,
    (issue) => issue.fittingSessionId,
  );
  const imageBySession = groupBy(
    imageRows,
    (image) => image.fittingSessionId,
  );
  const sessionsByPack = groupBy(
    sessionRows,
    (session) => session.technicalPackId,
  );
  const packById = new Map(packRows.map((pack) => [pack.id, pack]));
  const workById = new Map(works.map((work) => [work.id, work]));

  const sessions = sessionRows.map((session) => {
    const pack = packById.get(session.technicalPackId) ?? null;
    const work = workById.get(session.workId) ?? null;
    const issues = issueBySession.get(session.id) ?? [];
    const images = (imageBySession.get(session.id) ?? []).map((image) => ({
      ...image,
      imageUrl: mediaUrl(image.imageKey),
    }));
    const activeIssues = issues.filter(
      (issue) => issue.status !== "removed",
    );
    const openIssues = activeIssues.filter(
      (issue) => !["resolved"].includes(issue.status),
    );
    const criticalOpenIssues = openIssues.filter(
      (issue) => issue.severity === "critical",
    );
    const activeImages = images.filter(
      (image) => image.status === "active",
    );
    const missingFields = fittingMissingFields(session, activeImages);
    return {
      session,
      technicalPack: pack
        ? {
            id: pack.id,
            techPackCode: pack.techPackCode,
            revision: pack.revision,
            status: pack.status,
            sampleStage: pack.sampleStage,
            baseSize: pack.baseSize,
            unit: pack.unit,
            fitIntent: pack.fitIntent,
          }
        : null,
      work: work
        ? {
            id: work.id,
            title: work.title,
            lookNumber: work.lookNumber,
            collection: work.collection,
            status: work.status,
            imageUrl: mediaUrl(work.imageKey),
          }
        : null,
      issues,
      images,
      summary: {
        activeImages: activeImages.length,
        openIssues: openIssues.length,
        criticalOpenIssues: criticalOpenIssues.length,
        resolvedIssues: activeIssues.filter(
          (issue) => issue.status === "resolved",
        ).length,
        completeness: Math.round(
          ((7 - missingFields.length) / 7) * 100,
        ),
        missingFields,
        approvalReady:
          missingFields.length === 0 &&
          criticalOpenIssues.length === 0 &&
          session.decision === "approve" &&
          Boolean(pack && pack.status !== "draft"),
      },
    } satisfies FittingWorkspace;
  });

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      sessionCount: sessionRows.length,
      plannedCount: sessionRows.filter(
        (session) => session.status === "planned",
      ).length,
      reviewCount: sessionRows.filter(
        (session) => session.status === "in_review",
      ).length,
      approvedCount: sessionRows.filter((session) =>
        ["approved", "closed"].includes(session.status),
      ).length,
      incompleteCount: sessions.filter(
        (workspace) => workspace.summary.missingFields.length > 0,
      ).length,
      criticalOpenCount: sessions.reduce(
        (total, workspace) =>
          total + workspace.summary.criticalOpenIssues,
        0,
      ),
      packsWithoutFittingCount: packRows.filter(
        (pack) => !(sessionsByPack.get(pack.id) ?? []).length,
      ).length,
    },
    sessions,
    references: {
      technicalPacks: packRows.map((pack) => {
        const work = workById.get(pack.workId);
        const packSessions = sessionsByPack.get(pack.id) ?? [];
        return {
          id: pack.id,
          techPackCode: pack.techPackCode,
          revision: pack.revision,
          status: pack.status,
          sampleStage: pack.sampleStage,
          baseSize: pack.baseSize,
          unit: pack.unit,
          workId: pack.workId,
          workTitle: work?.title ?? "未找到作品",
          lookNumber: work?.lookNumber ?? "",
          collection: work?.collection ?? "",
          workImageUrl: work ? mediaUrl(work.imageKey) : "",
          latestFittingRound: packSessions.reduce(
            (latest, session) => Math.max(latest, session.round),
            0,
          ),
          hasApprovedFitting: packSessions.some((session) =>
            ["approved", "closed"].includes(session.status),
          ),
        };
      }),
    },
  };
}

export function fittingSessionsToCsv(
  overview: FittingOverview,
): string {
  const columns = [
    "fittingCode",
    "work",
    "lookNumber",
    "collection",
    "techPackCode",
    "techPackRevision",
    "round",
    "status",
    "decision",
    "sampleSize",
    "fittingAt",
    "location",
    "fitModelReference",
    "objective",
    "balanceNotes",
    "silhouetteNotes",
    "movementNotes",
    "comfortNotes",
    "conclusion",
    "nextFittingAt",
    "approvalNote",
    "approvedBy",
    "approvedAt",
    "notes",
    "completeness",
    "createdAt",
    "updatedAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.sessions.forEach((workspace) => {
    const { session, work, technicalPack } = workspace;
    lines.push(
      [
        session.fittingCode,
        work?.title ?? "",
        work?.lookNumber ?? "",
        work?.collection ?? "",
        technicalPack?.techPackCode ?? "",
        technicalPack?.revision ?? "",
        session.round,
        session.status,
        session.decision,
        session.sampleSize,
        session.fittingAt,
        session.location,
        session.fitModelReference,
        session.objective,
        session.balanceNotes,
        session.silhouetteNotes,
        session.movementNotes,
        session.comfortNotes,
        session.conclusion,
        session.nextFittingAt,
        session.approvalNote,
        session.approvedBy,
        session.approvedAt,
        session.notes,
        workspace.summary.completeness,
        session.createdAt,
        session.updatedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function fittingIssuesToCsv(
  overview: FittingOverview,
): string {
  const columns = [
    "fittingCode",
    "techPackCode",
    "work",
    "category",
    "area",
    "side",
    "observation",
    "alteration",
    "pointCode",
    "severity",
    "status",
    "ownerName",
    "dueAt",
    "resolvedAt",
    "sortOrder",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.sessions.forEach((workspace) => {
    workspace.issues.forEach((issue) => {
      lines.push(
        [
          workspace.session.fittingCode,
          workspace.technicalPack?.techPackCode ?? "",
          workspace.work?.title ?? "",
          issue.category,
          issue.area,
          issue.side,
          issue.observation,
          issue.alteration,
          issue.pointCode,
          issue.severity,
          issue.status,
          issue.ownerName,
          issue.dueAt,
          issue.resolvedAt,
          issue.sortOrder,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function fittingImagesToCsv(
  overview: FittingOverview,
): string {
  const columns = [
    "fittingCode",
    "work",
    "angle",
    "caption",
    "altText",
    "status",
    "objectKey",
    "contentType",
    "bytes",
    "sortOrder",
    "createdAt",
  ];
  const lines = [columns.map(csvCell).join(",")];
  overview.sessions.forEach((workspace) => {
    workspace.images.forEach((image) => {
      lines.push(
        [
          workspace.session.fittingCode,
          workspace.work?.title ?? "",
          image.angle,
          image.caption,
          image.altText,
          image.status,
          image.imageKey,
          image.imageType,
          image.imageSize,
          image.sortOrder,
          image.createdAt,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function fittingMissingFields(
  session: FittingSession,
  activeImages: FittingImage[],
): string[] {
  return [
    session.fittingAt ? "" : "试身时间",
    session.sampleSize ? "" : "样衣尺码",
    session.objective ? "" : "试身目标",
    session.balanceNotes ? "" : "平衡判断",
    session.movementNotes ? "" : "动态判断",
    session.conclusion ? "" : "审版结论",
    activeImages.length > 0 ? "" : "试身影像",
  ].filter(Boolean);
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

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
