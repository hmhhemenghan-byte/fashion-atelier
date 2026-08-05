import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  curatorialProjects,
  curatorialSelections,
  type CuratorialProject,
  type CuratorialSelection,
} from "@/db/schema";
import { listAllConservationReports } from "@/lib/conservation-reports";
import { listAllExhibitionRecoveries } from "@/lib/exhibition-recovery";
import { listAllExhibitionWatches } from "@/lib/exhibition-watch";
import { listAllSampleAssets } from "@/lib/sample-inventory";
import { mediaUrl } from "@/lib/works";

export const CURATORIAL_PROJECT_STATUSES = ["draft", "in_review", "approved", "closed", "void"] as const;
export const CURATORIAL_PROJECT_DECISIONS = ["pending", "approve", "revise", "hold"] as const;
export const CURATORIAL_SELECTION_DECISIONS = ["proposed", "include", "alternate", "hold", "exclude"] as const;
export const CURATORIAL_SELECTION_ROLES = ["anchor", "dialogue", "context", "transition", "finale"] as const;

export type CuratorialProjectStatus = (typeof CURATORIAL_PROJECT_STATUSES)[number];
export type CuratorialProjectDecision = (typeof CURATORIAL_PROJECT_DECISIONS)[number];
export type CuratorialSelectionDecision = (typeof CURATORIAL_SELECTION_DECISIONS)[number];
export type CuratorialSelectionRole = (typeof CURATORIAL_SELECTION_ROLES)[number];

export type CuratorialAssetReference = {
  id: string; assetCode: string; workTitle: string; lookNumber: string; status: string; condition: string;
  currentLocation: string; sizeLabel: string; colorLabel: string; imageUrl: string;
  latestConservation: { id: string; reportCode: string; status: string; decision: string; overallCondition: string; nextReviewAt: string | null } | null;
  latestRecovery: { recoveryCode: string; status: string; decision: string; releasedAt: string | null } | null;
  activeExhibition: boolean;
  eligible: boolean;
  warnings: string[];
};

export type CuratorialWorkspace = {
  project: CuratorialProject;
  selections: Array<CuratorialSelection & { asset: CuratorialAssetReference | null }>;
  summary: { included: number; alternates: number; proposed: number; blocked: number; missingFields: string[]; approvalReady: boolean };
};

export type CuratorialOverview = {
  generatedAt: string;
  metrics: { total: number; inReview: number; approved: number; selectedWorks: number; attention: number };
  projects: CuratorialWorkspace[];
  references: { assets: CuratorialAssetReference[] };
};

export async function listAllCuratorialProjects(limit = 4000) {
  const db = await getDb();
  return db.select().from(curatorialProjects).orderBy(desc(curatorialProjects.updatedAt)).limit(limit);
}

export async function listAllCuratorialSelections(limit = 24000) {
  const db = await getDb();
  return db.select().from(curatorialSelections).orderBy(asc(curatorialSelections.curatorialProjectId), asc(curatorialSelections.sequence)).limit(limit);
}

export async function getCuratorialProject(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(curatorialProjects).where(eq(curatorialProjects.id, id)).limit(1);
  return row ?? null;
}

export async function getCuratorialSelection(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(curatorialSelections).where(eq(curatorialSelections.id, id)).limit(1);
  return row ?? null;
}

export async function buildCuratorialOverview(now = new Date()): Promise<CuratorialOverview> {
  const [projects, selections, assets, reports, watches, recoveries] = await Promise.all([
    listAllCuratorialProjects(), listAllCuratorialSelections(), listAllSampleAssets(), listAllConservationReports(), listAllExhibitionWatches(), listAllExhibitionRecoveries(),
  ]);
  const latestReportByAsset = latestBy(reports.filter((item) => ["approved", "closed"].includes(item.status)), (item) => item.sampleAssetId, (item) => item.approvedAt || item.updatedAt);
  const latestRecoveryByAsset = latestBy(recoveries, (item) => item.sampleAssetId, (item) => item.releasedAt || item.referredAt || item.updatedAt);
  const activeAssetIds = new Set(watches.filter((item) => ["active", "paused"].includes(item.status)).map((item) => item.sampleAssetId));
  const assetReferences: CuratorialAssetReference[] = assets.map((asset) => {
    const report = latestReportByAsset.get(asset.id) ?? null;
    const recovery = latestRecoveryByAsset.get(asset.id) ?? null;
    const recoveryResolvedByConservation = Boolean(
      recovery && report && report.decision === "ready_for_use" &&
      new Date(report.approvedAt || report.updatedAt).getTime() > new Date(recovery.referredAt || recovery.updatedAt).getTime(),
    );
    const warnings: string[] = [];
    if (!report) warnings.push("缺少已批准养护报告");
    else if (report.decision !== "ready_for_use") warnings.push("最新养护结论未明确可用");
    if (!["available", "reserved"].includes(asset.status)) warnings.push(`实物状态为 ${asset.status}`);
    if (activeAssetIds.has(asset.id)) warnings.push("作品仍在展示或暂停监测中");
    if (recovery && !["released", "void"].includes(recovery.status) && !recoveryResolvedByConservation) warnings.push("最新展后复原尚未回库放行或后续养护复核");
    return {
      id: asset.id, assetCode: asset.assetCode, workTitle: asset.workTitle, lookNumber: asset.lookNumber,
      status: asset.status, condition: asset.condition, currentLocation: asset.currentLocation,
      sizeLabel: asset.sizeLabel, colorLabel: asset.colorLabel, imageUrl: asset.imageKey ? mediaUrl(asset.imageKey) : "",
      latestConservation: report ? { id: report.id, reportCode: report.reportCode, status: report.status, decision: report.decision, overallCondition: report.overallCondition, nextReviewAt: report.nextReviewAt } : null,
      latestRecovery: recovery ? { recoveryCode: recovery.recoveryCode, status: recovery.status, decision: recovery.decision, releasedAt: recovery.releasedAt } : null,
      activeExhibition: activeAssetIds.has(asset.id), eligible: warnings.length === 0, warnings,
    };
  });
  const assetById = new Map(assetReferences.map((item) => [item.id, item]));
  const selectionsByProject = groupBy(selections, (item) => item.curatorialProjectId);
  const workspaces = projects.map((project) => {
    const linked = (selectionsByProject.get(project.id) ?? []).map((item) => ({ ...item, asset: assetById.get(item.sampleAssetId) ?? null }));
    const included = linked.filter((item) => item.decision === "include");
    const missingFields = curatorialMissingFields(project, included);
    const blocked = included.filter((item) => !item.asset?.eligible).length;
    return {
      project,
      selections: linked,
      summary: {
        included: included.length,
        alternates: linked.filter((item) => item.decision === "alternate").length,
        proposed: linked.filter((item) => item.decision === "proposed").length,
        blocked,
        missingFields,
        approvalReady: missingFields.length === 0 && blocked === 0 && project.decision === "approve",
      },
    } satisfies CuratorialWorkspace;
  });
  return {
    generatedAt: now.toISOString(),
    metrics: {
      total: projects.length,
      inReview: projects.filter((item) => item.status === "in_review").length,
      approved: projects.filter((item) => item.status === "approved").length,
      selectedWorks: selections.filter((item) => item.decision === "include").length,
      attention: workspaces.filter((item) => !["approved", "closed", "void"].includes(item.project.status) && (item.summary.blocked > 0 || item.project.status === "in_review" && !item.summary.approvalReady)).length,
    },
    projects: workspaces,
    references: { assets: assetReferences },
  };
}

export function curatorialMissingFields(project: CuratorialProject, included: Array<CuratorialSelection & { asset?: CuratorialAssetReference | null }>) {
  const missing: string[] = [];
  if (!project.title.trim()) missing.push("项目标题");
  if (!project.curator.trim()) missing.push("策展负责人");
  if (!project.venueContext.trim()) missing.push("空间或场景");
  if (!project.audience.trim()) missing.push("目标观众");
  if (!project.thesis.trim()) missing.push("策展命题");
  if (!project.narrative.trim()) missing.push("叙事结构");
  if (!project.spatialNote.trim()) missing.push("空间编排");
  if (!project.selectionNote.trim()) missing.push("选择原则");
  if (!project.approvalNote.trim()) missing.push("人工决定依据");
  if (project.openingAt && project.closingAt && new Date(project.closingAt).getTime() <= new Date(project.openingAt).getTime()) missing.push("有效展期窗口");
  if (included.length < 2) missing.push("至少两件纳入作品");
  if (!included.some((item) => item.role === "anchor")) missing.push("至少一件叙事锚点");
  included.forEach((item) => {
    if (!item.rationale.trim()) missing.push(`${item.asset?.assetCode || "纳入作品"}选择依据`);
    if (!item.displayIntent.trim()) missing.push(`${item.asset?.assetCode || "纳入作品"}展示意图`);
  });
  return [...new Set(missing)];
}

export function curatorialProjectsToCsv(overview: CuratorialOverview) {
  return csv([["project_code", "title", "status", "decision", "curator", "venue_context", "audience", "opening_at", "closing_at", "included", "alternates"], ...overview.projects.map(({ project, summary }) => [project.projectCode, project.title, project.status, project.decision, project.curator, project.venueContext, project.audience, project.openingAt ?? "", project.closingAt ?? "", summary.included, summary.alternates])]);
}

export function curatorialSelectionsToCsv(overview: CuratorialOverview) {
  return csv([["project_code", "asset_code", "work_title", "decision", "role", "sequence", "rationale", "display_intent", "eligible", "warnings"], ...overview.projects.flatMap(({ project, selections }) => selections.map((item) => [project.projectCode, item.asset?.assetCode ?? "", item.asset?.workTitle ?? "", item.decision, item.role, item.sequence, item.rationale, item.displayIntent, item.asset?.eligible ? "yes" : "no", item.asset?.warnings.join(" | ") ?? ""]))]);
}

function latestBy<T>(rows: T[], key: (row: T) => string, date: (row: T) => string) {
  const result = new Map<string, T>();
  rows.forEach((row) => { const current = result.get(key(row)); if (!current || new Date(date(row)).getTime() > new Date(date(current)).getTime()) result.set(key(row), row); });
  return result;
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const result = new Map<string, T[]>();
  rows.forEach((row) => result.set(key(row), [...(result.get(key(row)) ?? []), row]));
  return result;
}

function csv(rows: Array<Array<string | number>>) {
  return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
}
