import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exhibitionOpeningGates, exhibitionOpeningItems, type ExhibitionOpeningGate, type ExhibitionOpeningItem } from "@/db/schema";
import { buildCuratorialOverview, type CuratorialWorkspace } from "@/lib/archive-curation";
import { buildExhibitionInstallationOverview, type ExhibitionInstallationWorkspace } from "@/lib/exhibition-installation";
import { buildExhibitionOverview, type ExhibitionWorkspace } from "@/lib/exhibition-readiness";

export const EXHIBITION_OPENING_STATUSES = ["draft", "in_review", "approved", "closed", "void"] as const;
export const EXHIBITION_OPENING_DECISIONS = ["pending", "open", "rework", "hold"] as const;
export const EXHIBITION_OPENING_RESULTS = ["pending", "ready", "attention", "blocked"] as const;
export type ExhibitionOpeningStatus = (typeof EXHIBITION_OPENING_STATUSES)[number];
export type ExhibitionOpeningDecision = (typeof EXHIBITION_OPENING_DECISIONS)[number];
export type ExhibitionOpeningResult = (typeof EXHIBITION_OPENING_RESULTS)[number];

export type ExhibitionOpeningItemView = ExhibitionOpeningItem & {
  selection: CuratorialWorkspace["selections"][number] | null;
  readiness: ExhibitionWorkspace | null;
  eligibleReadiness: ExhibitionWorkspace[];
};

export type ExhibitionOpeningWorkspace = {
  gate: ExhibitionOpeningGate;
  project: CuratorialWorkspace | null;
  installation: ExhibitionInstallationWorkspace | null;
  items: ExhibitionOpeningItemView[];
  summary: { expectedItems: number; readyItems: number; attentionItems: number; blockedItems: number; pendingItems: number; missingFields: string[]; approvalReady: boolean; upcomingUnapproved: boolean };
};

export type ExhibitionOpeningOverview = {
  generatedAt: string;
  metrics: { total: number; inReview: number; approved: number; items: number; attention: number };
  gates: ExhibitionOpeningWorkspace[];
  references: { installations: Array<{ id: string; gateCode: string; projectId: string; projectCode: string; title: string; venue: string; openingAt: string | null; closingAt: string | null; included: number; existingRevisions: number }> };
};

export async function listAllExhibitionOpeningGates(limit = 4000) { const db = await getDb(); return db.select().from(exhibitionOpeningGates).orderBy(desc(exhibitionOpeningGates.updatedAt)).limit(limit); }
export async function listAllExhibitionOpeningItems(limit = 36000) { const db = await getDb(); return db.select().from(exhibitionOpeningItems).orderBy(asc(exhibitionOpeningItems.exhibitionOpeningGateId), asc(exhibitionOpeningItems.sequence)).limit(limit); }
export async function getExhibitionOpeningGate(id: string) { const db = await getDb(); const [row] = await db.select().from(exhibitionOpeningGates).where(eq(exhibitionOpeningGates.id, id)).limit(1); return row ?? null; }
export async function getExhibitionOpeningItem(id: string) { const db = await getDb(); const [row] = await db.select().from(exhibitionOpeningItems).where(eq(exhibitionOpeningItems.id, id)).limit(1); return row ?? null; }

export async function buildExhibitionOpeningOverview(now = new Date()): Promise<ExhibitionOpeningOverview> {
  const [gates, items, curation, installation, readiness] = await Promise.all([listAllExhibitionOpeningGates(), listAllExhibitionOpeningItems(), buildCuratorialOverview(now), buildExhibitionInstallationOverview(now), buildExhibitionOverview(now)]);
  const projectById = new Map(curation.projects.map((item) => [item.project.id, item]));
  const installationById = new Map(installation.gates.map((item) => [item.gate.id, item]));
  const readinessById = new Map(readiness.plans.map((item) => [item.plan.id, item]));
  const eligibleByAsset = groupBy(readiness.plans.filter((item) => ["approved", "closed"].includes(item.plan.status)), (item) => item.plan.sampleAssetId);
  const itemsByGate = groupBy(items, (item) => item.exhibitionOpeningGateId);
  const revisionCountByProject = new Map<string, number>(); gates.forEach((item) => revisionCountByProject.set(item.curatorialProjectId, (revisionCountByProject.get(item.curatorialProjectId) ?? 0) + 1));
  const sevenDaysAt = now.getTime() + 7 * 86_400_000;
  const workspaces = gates.map((gate) => {
    const project = projectById.get(gate.curatorialProjectId) ?? null;
    const install = installationById.get(gate.exhibitionInstallationGateId) ?? null;
    const selections = new Map((project?.selections ?? []).map((item) => [item.id, item]));
    const linkedItems = (itemsByGate.get(gate.id) ?? []).map((item) => { const selection = selections.get(item.curatorialSelectionId) ?? null; return { ...item, selection, readiness: item.exhibitionReadinessPlanId ? readinessById.get(item.exhibitionReadinessPlanId) ?? null : null, eligibleReadiness: selection ? eligibleByAsset.get(selection.sampleAssetId) ?? [] : [] }; });
    const expectedItems = project?.selections.filter((item) => item.decision === "include").length ?? 0;
    const missingFields = exhibitionOpeningMissingFields(gate, linkedItems, expectedItems, project, install);
    const openingMs = timestamp(gate.plannedOpeningAt);
    return { gate, project, installation: install, items: linkedItems, summary: { expectedItems, readyItems: linkedItems.filter((item) => item.result === "ready").length, attentionItems: linkedItems.filter((item) => item.result === "attention").length, blockedItems: linkedItems.filter((item) => item.result === "blocked").length, pendingItems: linkedItems.filter((item) => item.result === "pending").length, missingFields, approvalReady: missingFields.length === 0 && gate.decision === "open", upcomingUnapproved: !["approved", "closed", "void"].includes(gate.status) && openingMs > 0 && openingMs <= sevenDaysAt } } satisfies ExhibitionOpeningWorkspace;
  });
  return { generatedAt: now.toISOString(), metrics: { total: gates.length, inReview: gates.filter((item) => item.status === "in_review").length, approved: gates.filter((item) => item.status === "approved").length, items: items.length, attention: workspaces.filter((item) => !["approved", "closed", "void"].includes(item.gate.status) && (item.summary.upcomingUnapproved || item.gate.decision === "rework" || item.summary.attentionItems + item.summary.blockedItems > 0)).length }, gates: workspaces, references: { installations: installation.gates.filter((item) => ["approved", "closed"].includes(item.gate.status) && item.delivery?.curatorialProjectId).flatMap((item) => { const project = projectById.get(item.delivery!.curatorialProjectId); if (!project || !["approved", "closed"].includes(project.project.status)) return []; return [{ id: item.gate.id, gateCode: item.gate.gateCode, projectId: project.project.id, projectCode: project.project.projectCode, title: project.project.title, venue: item.gate.venue, openingAt: project.project.openingAt ?? item.gate.openingAt, closingAt: project.project.closingAt, included: project.selections.filter((selection) => selection.decision === "include").length, existingRevisions: revisionCountByProject.get(project.project.id) ?? 0 }]; }) } };
}

export function exhibitionOpeningMissingFields(gate: ExhibitionOpeningGate, items: ExhibitionOpeningItemView[], expectedItems: number, project: CuratorialWorkspace | null, installation: ExhibitionInstallationWorkspace | null) {
  const missing: string[] = [];
  if (!gate.openingLead.trim()) missing.push("开放负责人"); if (!gate.venue.trim()) missing.push("场馆或展区"); if (!gate.plannedOpeningAt) missing.push("计划开放时间"); if (!gate.plannedClosingAt) missing.push("计划闭展时间");
  if (!gate.operatingBrief.trim()) missing.push("开放运行简报"); if (!gate.dailyCheckCadence.trim()) missing.push("每日检查节奏"); if (!gate.staffHandover.trim()) missing.push("现场人员交接"); if (!gate.visitorAccessibilityPlan.trim()) missing.push("观众无障碍方案"); if (!gate.incidentEscalation.trim()) missing.push("事件升级路径"); if (!gate.emergencyPauseRule.trim()) missing.push("紧急暂停规则"); if (!gate.approvalNote.trim()) missing.push("人工开放依据");
  if (gate.plannedOpeningAt && gate.plannedClosingAt && timestamp(gate.plannedClosingAt) <= timestamp(gate.plannedOpeningAt)) missing.push("有效开放时间窗口");
  if (!project || !["approved", "closed"].includes(project.project.status)) missing.push("已批准策展项目");
  if (!installation || !["approved", "closed"].includes(installation.gate.status) || installation.delivery?.curatorialProjectId !== gate.curatorialProjectId) missing.push("同一策展项目的已批准装校签核");
  if (expectedItems <= 0 || items.length !== expectedItems) missing.push("全部纳入作品的开放核对");
  items.forEach((item) => { const label = item.selection?.asset?.assetCode || "纳入作品"; if (!item.selection || item.selection.decision !== "include") missing.push(`${label}策展选择`); if (item.result !== "ready") missing.push(`${label}开放结果`); if (!item.displayLocation.trim()) missing.push(`${label}现场位置`); if (!item.readinessNote.trim()) missing.push(`${label}展陈就绪依据`); if (!item.handoverNote.trim()) missing.push(`${label}人员交接`); if (!item.readiness || !["approved", "closed"].includes(item.readiness.plan.status) || item.readiness.plan.sampleAssetId !== item.selection?.sampleAssetId) missing.push(`${label}已批准展陈方案`); if (item.readiness && gate.plannedOpeningAt && item.readiness.plan.installAt && timestamp(item.readiness.plan.installAt) > timestamp(gate.plannedOpeningAt)) missing.push(`${label}开放前完成试装`); if (item.readiness && gate.plannedClosingAt && item.readiness.plan.deinstallAt && timestamp(item.readiness.plan.deinstallAt) < timestamp(gate.plannedClosingAt)) missing.push(`${label}覆盖完整展期`); });
  return [...new Set(missing)];
}

export function openingItemsForProject(project: CuratorialWorkspace, gateId: string, createdBy: string, nowIso: string) { return project.selections.filter((item) => item.decision === "include").map((item, index) => ({ id: crypto.randomUUID(), exhibitionOpeningGateId: gateId, curatorialSelectionId: item.id, exhibitionReadinessPlanId: null, sequence: item.sequence || index + 1, result: "pending" as const, displayLocation: item.displayIntent, readinessNote: "", handoverNote: "", createdBy, createdAt: nowIso, updatedAt: nowIso })); }
export function openingGatesToCsv(overview: ExhibitionOpeningOverview) { return csv([["opening_code", "project_code", "installation_gate", "revision", "status", "decision", "lead", "venue", "opening_at", "closing_at", "items", "ready"], ...overview.gates.map((item) => [item.gate.openingCode, item.project?.project.projectCode ?? "", item.installation?.gate.gateCode ?? "", item.gate.revision, item.gate.status, item.gate.decision, item.gate.openingLead, item.gate.venue, item.gate.plannedOpeningAt ?? "", item.gate.plannedClosingAt ?? "", item.items.length, item.summary.readyItems])]); }
export function openingItemsToCsv(overview: ExhibitionOpeningOverview) { return csv([["opening_code", "asset_code", "work_title", "sequence", "result", "readiness_plan", "display_location", "readiness_note", "handover_note"], ...overview.gates.flatMap((workspace) => workspace.items.map((item) => [workspace.gate.openingCode, item.selection?.asset?.assetCode ?? "", item.selection?.asset?.workTitle ?? "", item.sequence, item.result, item.readiness?.plan.planCode ?? "", item.displayLocation, item.readinessNote, item.handoverNote]))]); }
function timestamp(value: string | null) { if (!value) return 0; const result = new Date(value).getTime(); return Number.isNaN(result) ? 0 : result; }
function groupBy<T>(rows: T[], key: (row: T) => string) { const result = new Map<string, T[]>(); rows.forEach((row) => result.set(key(row), [...(result.get(key(row)) ?? []), row])); return result; }
function csv(rows: Array<Array<string | number>>) { return `\ufeff${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n")}`; }
