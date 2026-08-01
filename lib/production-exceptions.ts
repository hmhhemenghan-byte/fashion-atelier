import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  productionExceptionActions,
  productionExceptions,
  type ProductionException,
  type ProductionExceptionAction,
} from "@/db/schema";
import { listAllProductionReleases } from "@/lib/production-releases";
import { listAllWorks, mediaUrl } from "@/lib/works";

export const PRODUCTION_EXCEPTION_CATEGORIES = [
  "material",
  "color",
  "construction",
  "measurement",
  "finish",
  "label",
  "packaging",
  "schedule",
  "other",
] as const;

export const PRODUCTION_EXCEPTION_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const PRODUCTION_EXCEPTION_STATUSES = [
  "open",
  "in_review",
  "decided",
  "verified",
  "closed",
  "withdrawn",
] as const;

export const PRODUCTION_EXCEPTION_DECISIONS = [
  "pending",
  "accept_once",
  "rework",
  "revise_definition",
  "reject",
  "hold",
] as const;

export const PRODUCTION_EXCEPTION_ACTION_TYPES = [
  "reported",
  "review_note",
  "evidence",
  "response",
  "decision",
  "verification",
  "closure",
] as const;

export type ProductionExceptionCategory =
  (typeof PRODUCTION_EXCEPTION_CATEGORIES)[number];
export type ProductionExceptionSeverity =
  (typeof PRODUCTION_EXCEPTION_SEVERITIES)[number];
export type ProductionExceptionStatus =
  (typeof PRODUCTION_EXCEPTION_STATUSES)[number];
export type ProductionExceptionDecision =
  (typeof PRODUCTION_EXCEPTION_DECISIONS)[number];
export type ProductionExceptionActionType =
  (typeof PRODUCTION_EXCEPTION_ACTION_TYPES)[number];

export type ProductionExceptionWorkspace = {
  exception: ProductionException;
  release: {
    id: string;
    releaseCode: string;
    authorizationCode: string | null;
    factoryName: string;
    sizeRange: string;
    colorways: string;
    releasedAt: string | null;
  } | null;
  work: {
    id: string;
    title: string;
    lookNumber: string;
    collection: string;
    imageUrl: string;
  } | null;
  actions: ProductionExceptionAction[];
  summary: {
    ageDays: number;
    overdue: boolean;
    attention: boolean;
    missingFields: string[];
  };
};

export type ProductionExceptionOverview = {
  generatedAt: string;
  metrics: {
    total: number;
    open: number;
    inReview: number;
    decided: number;
    verified: number;
    closed: number;
    criticalOpen: number;
    overdue: number;
  };
  exceptions: ProductionExceptionWorkspace[];
  references: {
    releasedSources: Array<{
      productionReleaseId: string;
      releaseCode: string;
      authorizationCode: string;
      factoryName: string;
      workId: string;
      workTitle: string;
      lookNumber: string;
      collection: string;
      imageUrl: string;
      openExceptionCount: number;
    }>;
  };
};

export async function listAllProductionExceptions(limit = 8000) {
  const db = await getDb();
  return db
    .select()
    .from(productionExceptions)
    .orderBy(
      desc(productionExceptions.updatedAt),
      desc(productionExceptions.createdAt),
    )
    .limit(limit);
}

export async function listAllProductionExceptionActions(limit = 32000) {
  const db = await getDb();
  return db
    .select()
    .from(productionExceptionActions)
    .orderBy(
      asc(productionExceptionActions.productionExceptionId),
      asc(productionExceptionActions.occurredAt),
    )
    .limit(limit);
}

export async function getProductionException(id: string) {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(productionExceptions)
    .where(eq(productionExceptions.id, id))
    .limit(1);
  return record ?? null;
}

export async function buildProductionExceptionOverview():
  Promise<ProductionExceptionOverview> {
  const [exceptions, actions, releases, works] = await Promise.all([
    listAllProductionExceptions(),
    listAllProductionExceptionActions(),
    listAllProductionReleases(),
    listAllWorks(4000),
  ]);
  const releaseById = new Map(releases.map((item) => [item.id, item]));
  const workById = new Map(works.map((item) => [item.id, item]));
  const actionsByExceptionId = groupBy(
    actions,
    (item) => item.productionExceptionId,
  );
  const exceptionsByReleaseId = groupBy(
    exceptions,
    (item) => item.productionReleaseId,
  );
  const now = new Date();

  const workspaces: ProductionExceptionWorkspace[] = exceptions.map(
    (record) => {
      const release = releaseById.get(record.productionReleaseId) ?? null;
      const work = workById.get(record.workId) ?? null;
      const missingFields = productionExceptionMissingFields(record);
      const ageDays = Math.max(
        0,
        Math.floor(
          (now.getTime() - timestamp(record.discoveredAt || record.createdAt)) /
            86_400_000,
        ),
      );
      const overdue =
        !["closed", "withdrawn"].includes(record.status) &&
        Boolean(record.dueAt) &&
        timestamp(record.dueAt) < startOfToday(now);
      return {
        exception: record,
        release: release
          ? {
              id: release.id,
              releaseCode: release.releaseCode,
              authorizationCode: release.authorizationCode,
              factoryName: release.factoryName,
              sizeRange: release.sizeRange,
              colorways: release.colorways,
              releasedAt: release.releasedAt,
            }
          : null,
        work: work
          ? {
              id: work.id,
              title: work.title,
              lookNumber: work.lookNumber,
              collection: work.collection,
              imageUrl: mediaUrl(work.imageKey),
            }
          : null,
        actions: actionsByExceptionId.get(record.id) ?? [],
        summary: {
          ageDays,
          overdue,
          attention:
            overdue ||
            ["high", "critical"].includes(record.severity) ||
            (["open", "in_review"].includes(record.status) &&
              missingFields.length > 0),
          missingFields,
        },
      };
    },
  );

  return {
    generatedAt: now.toISOString(),
    metrics: {
      total: exceptions.length,
      open: exceptions.filter((item) => item.status === "open").length,
      inReview: exceptions.filter((item) => item.status === "in_review").length,
      decided: exceptions.filter((item) => item.status === "decided").length,
      verified: exceptions.filter((item) => item.status === "verified").length,
      closed: exceptions.filter((item) => item.status === "closed").length,
      criticalOpen: exceptions.filter(
        (item) =>
          item.severity === "critical" &&
          !["closed", "withdrawn"].includes(item.status),
      ).length,
      overdue: workspaces.filter((item) => item.summary.overdue).length,
    },
    exceptions: workspaces,
    references: {
      releasedSources: releases
        .filter(
          (release) =>
            release.status === "released" &&
            Boolean(release.authorizationCode),
        )
        .flatMap((release) => {
          const work = workById.get(release.workId);
          if (!work || !release.authorizationCode) return [];
          const linked = exceptionsByReleaseId.get(release.id) ?? [];
          return [
            {
              productionReleaseId: release.id,
              releaseCode: release.releaseCode,
              authorizationCode: release.authorizationCode,
              factoryName: release.factoryName,
              workId: work.id,
              workTitle: work.title,
              lookNumber: work.lookNumber,
              collection: work.collection,
              imageUrl: mediaUrl(work.imageKey),
              openExceptionCount: linked.filter(
                (item) => !["closed", "withdrawn"].includes(item.status),
              ).length,
            },
          ];
        })
        .sort(
          (left, right) =>
            left.lookNumber.localeCompare(right.lookNumber) ||
            left.releaseCode.localeCompare(right.releaseCode),
        ),
    },
  };
}

export function productionExceptionMissingFields(record: ProductionException) {
  const missing: string[] = [];
  if (!record.affectedScope.trim()) missing.push("影响范围");
  if (!record.observedDeviation.trim()) missing.push("偏差事实");
  if (!record.proposedResponse.trim()) missing.push("建议处置");
  if (!record.designImpact.trim()) missing.push("设计影响");
  if (!record.qualityRisk.trim()) missing.push("质量风险");
  if (!record.ownerName.trim()) missing.push("负责人");
  if (!record.discoveredAt) missing.push("发现日期");
  return missing;
}

export function productionExceptionsToCsv(
  overview: ProductionExceptionOverview,
) {
  const rows = overview.exceptions.map(({ exception, release, work }) => [
    exception.exceptionCode,
    release?.releaseCode ?? "",
    release?.authorizationCode ?? "",
    work?.lookNumber ?? "",
    work?.title ?? "",
    exception.category,
    exception.severity,
    exception.status,
    exception.decision,
    exception.title,
    exception.sourceName,
    exception.sourceReference,
    exception.affectedScope,
    exception.observedDeviation,
    exception.proposedResponse,
    exception.designImpact,
    exception.qualityRisk,
    exception.evidenceReference,
    exception.ownerName,
    exception.discoveredAt ?? "",
    exception.dueAt ?? "",
    exception.decidedBy,
    exception.decidedAt ?? "",
    exception.verificationNote,
    exception.verifiedBy,
    exception.verifiedAt ?? "",
    exception.resolutionNote,
    exception.successorReleaseCode,
    exception.closedAt ?? "",
    exception.updatedAt,
  ]);
  return csv(
    [
      "exception_code",
      "release_code",
      "authorization_code",
      "look_number",
      "work_title",
      "category",
      "severity",
      "status",
      "decision",
      "title",
      "source_name",
      "source_reference",
      "affected_scope",
      "observed_deviation",
      "proposed_response",
      "design_impact",
      "quality_risk",
      "evidence_reference",
      "owner_name",
      "discovered_at",
      "due_at",
      "decided_by",
      "decided_at",
      "verification_note",
      "verified_by",
      "verified_at",
      "resolution_note",
      "successor_release_code",
      "closed_at",
      "updated_at",
    ],
    rows,
  );
}

export function productionExceptionActionsToCsv(
  overview: ProductionExceptionOverview,
) {
  const rows = overview.exceptions.flatMap(({ exception, actions }) =>
    actions.map((action) => [
      exception.exceptionCode,
      action.actionType,
      action.note,
      action.reference,
      action.occurredAt,
      action.createdBy,
      action.createdAt,
    ]),
  );
  return csv(
    [
      "exception_code",
      "action_type",
      "note",
      "reference",
      "occurred_at",
      "created_by",
      "created_at",
    ],
    rows,
  );
}

function csv(headers: string[], rows: string[][]) {
  const lines = [headers, ...rows].map((row) =>
    row.map(csvCell).join(","),
  );
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function csvCell(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function groupBy<T>(
  items: T[],
  key: (item: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  items.forEach((item) => {
    const id = key(item);
    grouped.set(id, [...(grouped.get(id) ?? []), item]);
  });
  return grouped;
}

function timestamp(value: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function startOfToday(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).getTime();
}
