import {
  and,
  asc,
  desc,
  eq,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleAssets,
  sampleAuditItems,
  sampleAudits,
  type SampleAsset,
  type SampleAudit,
  type SampleAuditItem,
} from "@/db/schema";
import type { SampleLoanItemStatus } from "@/lib/sample-loans";

export const SAMPLE_ASSET_CATEGORIES = [
  "garment",
  "accessory",
  "footwear",
  "bag",
  "jewelry",
  "other",
] as const;

export const SAMPLE_ASSET_STATUSES = [
  "available",
  "reserved",
  "in_transit",
  "out_on_loan",
  "maintenance",
  "missing",
  "archived",
] as const;

export const SAMPLE_ASSET_CONDITIONS = [
  "not_checked",
  "excellent",
  "good",
  "worn",
  "damaged",
] as const;

export const SAMPLE_AUDIT_STATUSES = [
  "counting",
  "review",
  "completed",
  "cancelled",
] as const;

export const SAMPLE_AUDIT_RESULTS = [
  "pending",
  "matched",
  "accounted_out",
  "misplaced",
  "missing",
  "unexpected",
] as const;

export type SampleAssetCategory =
  (typeof SAMPLE_ASSET_CATEGORIES)[number];
export type SampleAssetStatus = (typeof SAMPLE_ASSET_STATUSES)[number];
export type SampleAssetCondition =
  (typeof SAMPLE_ASSET_CONDITIONS)[number];
export type SampleAuditStatus = (typeof SAMPLE_AUDIT_STATUSES)[number];
export type SampleAuditResult = (typeof SAMPLE_AUDIT_RESULTS)[number];

export type SampleAuditWorkspace = {
  audit: SampleAudit;
  items: SampleAuditItem[];
  summary: {
    total: number;
    pending: number;
    matched: number;
    accountedOut: number;
    misplaced: number;
    missing: number;
    unexpected: number;
    unresolved: number;
  };
};

export type SampleAssetWithAssignment = {
  asset: SampleAsset;
  assignment: {
    loanId: string;
    loanCode: string;
    loanStatus: string;
    loanItemId: string;
    projectTitle: string;
    requesterName: string;
  } | null;
};

export async function listAllSampleAssets(limit = 5000) {
  const db = await getDb();
  return db
    .select()
    .from(sampleAssets)
    .orderBy(
      asc(sampleAssets.status),
      asc(sampleAssets.assetCode),
      desc(sampleAssets.updatedAt),
    )
    .limit(limit);
}

export async function getSampleAsset(id: string) {
  const db = await getDb();
  const [asset] = await db
    .select()
    .from(sampleAssets)
    .where(eq(sampleAssets.id, id))
    .limit(1);
  return asset ?? null;
}

export async function findSampleAssetByCode(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  const db = await getDb();
  const [asset] = await db
    .select()
    .from(sampleAssets)
    .where(
      or(
        eq(sampleAssets.assetCode, normalized),
        eq(sampleAssets.tagCode, normalized),
      ),
    )
    .limit(1);
  return asset ?? null;
}

export async function listAllSampleAudits(limit = 1000) {
  const db = await getDb();
  return db
    .select()
    .from(sampleAudits)
    .orderBy(desc(sampleAudits.startedAt), desc(sampleAudits.createdAt))
    .limit(limit);
}

export async function listAllSampleAuditItems() {
  const db = await getDb();
  return db
    .select()
    .from(sampleAuditItems)
    .orderBy(
      asc(sampleAuditItems.auditId),
      asc(sampleAuditItems.assetCode),
    );
}

export async function listSampleAuditWorkspaces(limit = 100) {
  const audits = await listAllSampleAudits(limit);
  if (audits.length === 0) return [] satisfies SampleAuditWorkspace[];
  const db = await getDb();
  const items = await db
    .select()
    .from(sampleAuditItems)
    .where(
      inArray(
        sampleAuditItems.auditId,
        audits.map((audit) => audit.id),
      ),
    )
    .orderBy(asc(sampleAuditItems.assetCode));
  const byAudit = new Map<string, SampleAuditItem[]>();
  items.forEach((item) => {
    const current = byAudit.get(item.auditId) ?? [];
    current.push(item);
    byAudit.set(item.auditId, current);
  });
  return audits.map((audit) =>
    auditWorkspace(audit, byAudit.get(audit.id) ?? []),
  );
}

export async function getSampleAuditWorkspace(id: string) {
  const db = await getDb();
  const [audit] = await db
    .select()
    .from(sampleAudits)
    .where(eq(sampleAudits.id, id))
    .limit(1);
  if (!audit) return null;
  const items = await db
    .select()
    .from(sampleAuditItems)
    .where(eq(sampleAuditItems.auditId, id))
    .orderBy(asc(sampleAuditItems.assetCode));
  return auditWorkspace(audit, items);
}

export async function listAssetsForAuditScope(input: {
  location: string;
  department: string;
}) {
  const filters = [sql`${sampleAssets.status} <> 'archived'`];
  if (input.location) {
    filters.push(eq(sampleAssets.currentLocation, input.location));
  }
  if (input.department) {
    filters.push(eq(sampleAssets.department, input.department));
  }
  const db = await getDb();
  return db
    .select()
    .from(sampleAssets)
    .where(and(...filters))
    .orderBy(asc(sampleAssets.assetCode));
}

export function assetStatusForLoanItem(
  status: SampleLoanItemStatus,
): SampleAssetStatus {
  if (status === "reserved" || status === "packing") return "reserved";
  if (status === "dispatched" || status === "returning") {
    return "in_transit";
  }
  if (status === "with_recipient") return "out_on_loan";
  if (status === "returned") return "available";
  if (status === "damaged" || status === "unavailable") {
    return "maintenance";
  }
  return "missing";
}

export function sampleAssetsToCsv(rows: SampleAssetWithAssignment[]) {
  const columns = [
    "assetCode",
    "tagCode",
    "workTitle",
    "lookNumber",
    "size",
    "color",
    "category",
    "status",
    "condition",
    "department",
    "homeLocation",
    "currentLocation",
    "activeLoanCode",
    "activeProject",
    "activeRequester",
    "lastSeenAt",
    "lastAuditAt",
    "notes",
    "createdAt",
    "updatedAt",
  ] as const;
  const lines = [columns.map(csvCell).join(",")];
  rows.forEach(({ asset, assignment }) => {
    lines.push(
      [
        asset.assetCode,
        asset.tagCode,
        asset.workTitle,
        asset.lookNumber,
        asset.sizeLabel,
        asset.colorLabel,
        asset.category,
        asset.status,
        asset.condition,
        asset.department,
        asset.homeLocation,
        asset.currentLocation,
        assignment?.loanCode ?? "",
        assignment?.projectTitle ?? "",
        assignment?.requesterName ?? "",
        asset.lastSeenAt,
        asset.lastAuditAt,
        asset.notes,
        asset.createdAt,
        asset.updatedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

export function sampleAuditToCsv(workspace: SampleAuditWorkspace) {
  const columns = [
    "auditCode",
    "auditLabel",
    "auditStatus",
    "scopeLocation",
    "scopeDepartment",
    "assetCode",
    "workTitle",
    "expectedStatus",
    "expectedLocation",
    "observedLocation",
    "observedCondition",
    "result",
    "scannedAt",
    "resolvedAt",
    "resolutionNote",
  ] as const;
  const lines = [columns.map(csvCell).join(",")];
  workspace.items.forEach((item) => {
    lines.push(
      [
        workspace.audit.auditCode,
        workspace.audit.label,
        workspace.audit.status,
        workspace.audit.scopeLocation,
        workspace.audit.scopeDepartment,
        item.assetCode,
        item.workTitle,
        item.expectedStatus,
        item.expectedLocation,
        item.observedLocation,
        item.observedCondition,
        item.result,
        item.scannedAt,
        item.resolvedAt,
        item.resolutionNote,
      ]
        .map(csvCell)
        .join(","),
    );
  });
  return `\ufeff${lines.join("\r\n")}`;
}

function auditWorkspace(
  audit: SampleAudit,
  items: SampleAuditItem[],
): SampleAuditWorkspace {
  const summary = {
    total: items.length,
    pending: items.filter((item) => item.result === "pending").length,
    matched: items.filter((item) => item.result === "matched").length,
    accountedOut: items.filter((item) => item.result === "accounted_out")
      .length,
    misplaced: items.filter((item) => item.result === "misplaced").length,
    missing: items.filter((item) => item.result === "missing").length,
    unexpected: items.filter((item) => item.result === "unexpected").length,
    unresolved: items.filter(
      (item) =>
        ["misplaced", "missing", "unexpected"].includes(item.result) &&
        !item.resolvedAt,
    ).length,
  };
  return { audit, items, summary };
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export type {
  SampleAsset,
  SampleAudit,
  SampleAuditItem,
} from "@/db/schema";
